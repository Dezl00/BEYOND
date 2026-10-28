#include "scanner_bridge.h"
#include "scanner_transfer.h"
#include <flutter/method_result_functions.h>
#include <wia.h>
#include <wrl/client.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <utility>

namespace {
using Microsoft::WRL::ComPtr;
using Value=flutter::EncodableValue;using Map=flutter::EncodableMap;
constexpr UINT kScanMessage=WM_APP+0x271;
constexpr wchar_t kDispatcherClass[]=L"BeyondScannerDispatcher";
struct ScanEvent {bool done=false;int page=0;std::vector<uint8_t> bytes;std::string warning;bool feeder=false;bool cancelled=false;};
struct Session {
 std::mutex mutex;std::condition_variable condition;std::deque<ScanEvent> events;
 std::atomic_bool cancelled{false};std::atomic<DWORD> thread{0};
 HWND dispatcher=nullptr;bool closed=false;bool delivery_failed=false;int acknowledged=0;
 int max_pages=50;std::string id;
};
bool Post(const std::shared_ptr<Session>& session,ScanEvent event){
 std::lock_guard<std::mutex> lock(session->mutex);if(session->closed)return false;
 session->events.push_back(std::move(event));
 if(!PostMessageW(session->dispatcher,kScanMessage,0,0)){session->cancelled=true;session->events.clear();return false;}return true;
}
bool Publish(const std::shared_ptr<Session>& session,int index,std::vector<uint8_t>&& bytes){
 ScanEvent event;event.page=index;event.bytes=std::move(bytes);
 if(!Post(session,std::move(event)))return false;
 std::unique_lock<std::mutex> lock(session->mutex);
 if(!session->condition.wait_for(lock,std::chrono::seconds(30),[&]{return session->closed||session->cancelled||session->acknowledged>=index;})){session->delivery_failed=true;session->cancelled=true;}
 return !session->closed&&!session->cancelled&&session->acknowledged>=index;
}
ComPtr<IWiaItem2> FindItem(IWiaItem2* item,const GUID* category,int depth=0){
 if(!item||depth>12)return {};GUID current{};LONG type=0;
 if(category){if(SUCCEEDED(item->GetItemCategory(&current))&&IsEqualGUID(current,*category)){ComPtr<IWiaItem2> found=item;return found;}}
 else if(SUCCEEDED(item->GetItemType(&type))&&(type&WiaItemTypeImage)){ComPtr<IWiaTransfer> transfer;if(SUCCEEDED(item->QueryInterface(IID_PPV_ARGS(&transfer)))){ComPtr<IWiaItem2> found=item;return found;}}
 ComPtr<IEnumWiaItem2> children;if(FAILED(item->EnumChildItems(nullptr,&children)))return {};
 ComPtr<IWiaItem2> child;ULONG fetched=0;
 while(children->Next(1,&child,&fetched)==S_OK&&fetched){auto found=FindItem(child.Get(),category,depth+1);if(found)return found;child.Reset();}
 return {};
}
HRESULT WriteLong(IWiaPropertyStorage* properties,PROPID id,LONG number){
 PROPSPEC spec{};spec.ulKind=PRSPEC_PROPID;spec.propid=id;PROPVARIANT value{};value.vt=VT_I4;value.lVal=number;return properties->WriteMultiple(1,&spec,&value,2);
}
HRESULT WriteGuid(IWiaPropertyStorage* properties,PROPID id,const GUID& guid){
 PROPSPEC spec{};spec.ulKind=PRSPEC_PROPID;spec.propid=id;PROPVARIANT value{};value.vt=VT_CLSID;value.puuid=const_cast<GUID*>(&guid);return properties->WriteMultiple(1,&spec,&value,2);
}
bool ConfigureImage(IWiaPropertyStorage* properties){
 WriteLong(properties,WIA_IPS_CUR_INTENT,WIA_INTENT_IMAGE_TYPE_COLOR);
 // 200 DPI keeps even uncompressed A4 pages within the in-memory page budget.
 WriteLong(properties,WIA_IPS_XRES,200);WriteLong(properties,WIA_IPS_YRES,200);

 // Select a per-page format so no multi-page TIFF can hide additional sheets.
 bool format=false;for(const GUID* guid:{&WiaImgFmt_JPEG,&WiaImgFmt_PNG,&WiaImgFmt_BMP})if(SUCCEEDED(WriteGuid(properties,WIA_IPA_FORMAT,*guid))){format=true;break;}
 if(!format){
  PROPSPEC spec{};spec.ulKind=PRSPEC_PROPID;spec.propid=WIA_IPA_FORMAT;PROPVARIANT value{};
  if(SUCCEEDED(properties->ReadMultiple(1,&spec,&value))&&value.vt==VT_CLSID&&value.puuid)format=IsEqualGUID(*value.puuid,WiaImgFmt_JPEG)||IsEqualGUID(*value.puuid,WiaImgFmt_PNG)||IsEqualGUID(*value.puuid,WiaImgFmt_BMP);
  PropVariantClear(&value);
 }
 return format;
}
std::string TransferWarning(const beyond::ScanOutcome& result,bool delivery_failed){
 if(delivery_failed)return "تعذر تجهيز صفحة المسح. الصفحات المكتملة ما زالت في المعاينة.";
 if(result.stop==beyond::ScanStop::limit)return "وصلت الدفعة إلى 50 فاتورة. صدّر الدفعة ثم أكمل مسح الأوراق المتبقية.";
 if(result.stop==beyond::ScanStop::oversized)return "حجم إحدى الصفحات يتجاوز 25 ميجابايت. الصفحات المكتملة ما زالت في المعاينة.";
 if(result.stop!=beyond::ScanStop::failed)return {};
 if(result.error==WIA_ERROR_PAPER_JAM)return "انحشر ورق في المغذّي. عالج الانحشار ثم أكمل المسح؛ الصفحات المكتملة ما زالت في المعاينة.";
 if(result.error==WIA_ERROR_MULTI_FEED)return "سحب الماسح أكثر من ورقة معًا. افصل الأوراق ثم أكمل المسح؛ الصفحات المكتملة ما زالت في المعاينة.";
 return "توقف الماسح قبل إكمال الدفعة. تحقق من توصيله والورق ثم أكمل المسح؛ الصفحات المكتملة ما زالت في المعاينة.";
}
void Worker(const std::shared_ptr<Session>& session,std::wstring device_id){
 ScanEvent finished;finished.done=true;
 const HRESULT initialized=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
 if(FAILED(initialized)){finished.warning="تعذر بدء خدمة المسح الضوئي.";Post(session,std::move(finished));return;}
 CoEnableCallCancellation(nullptr);session->thread=GetCurrentThreadId();
 {
  try{
   ComPtr<IWiaDevMgr2> manager;ComPtr<IWiaItem2> root;
   HRESULT hr=CoCreateInstance(CLSID_WiaDevMgr2,nullptr,CLSCTX_LOCAL_SERVER,IID_PPV_ARGS(&manager));
   BSTR id=SysAllocString(device_id.c_str());if(SUCCEEDED(hr))hr=manager->CreateDevice(0,id,&root);SysFreeString(id);
   if(FAILED(hr)||!root)finished.warning="تعذر الاتصال بالماسح المحدد. تحقق من تشغيله وتعريف WIA.";
   else {
    auto item=FindItem(root.Get(),&WIA_CATEGORY_FEEDER);finished.feeder=item!=nullptr;
    if(!item)item=FindItem(root.Get(),&WIA_CATEGORY_FLATBED);if(!item)item=FindItem(root.Get(),nullptr);
    ComPtr<IWiaTransfer> transfer;ComPtr<IWiaPropertyStorage> properties;
    if(!item||FAILED(item->QueryInterface(IID_PPV_ARGS(&transfer)))||FAILED(item->QueryInterface(IID_PPV_ARGS(&properties))))finished.warning="تعريف الماسح لا يتيح نقل صور الصفحات عبر WIA.";
    else if(!ConfigureImage(properties.Get()))finished.warning="تعريف الماسح لا يدعم صورة مستقلة لكل صفحة. استخدم تعريف WIA الخاص بالشركة المصنّعة.";
    else {
     beyond::ScanOptions options;options.max_pages=session->max_pages;options.feeder=finished.feeder;
     options.cancelled=[session]{return session->cancelled.load();};int index=0;
     options.publish=[session,&index](std::vector<uint8_t>&& bytes){return Publish(session,++index,std::move(bytes));};
     const auto outcome=beyond::TransferPages(options,[&](IWiaTransferCallback* callback,int remaining){
      if(finished.feeder&&FAILED(WriteLong(properties.Get(),WIA_IPS_PAGES,remaining))){
       // Some drivers only accept ALL_PAGES. The callback still enforces the remaining limit.
       if(FAILED(WriteLong(properties.Get(),WIA_IPS_PAGES,0)))WriteLong(properties.Get(),WIA_IPS_PAGES,1);
      }
      return transfer->Download(0,callback);
     });
     finished.page=outcome.pages;finished.cancelled=outcome.stop==beyond::ScanStop::cancelled;
     {std::lock_guard<std::mutex> lock(session->mutex);finished.warning=TransferWarning(outcome,session->delivery_failed);}
     if(!outcome.pages&&outcome.stop==beyond::ScanStop::complete)finished.warning=finished.feeder?"المغذّي التلقائي فارغ. ضع الأوراق ثم أعد المسح.":"الماسح لم يُرجع صورة صالحة.";
    }
   }
  }catch(...){finished.warning="تعذر إكمال المسح. الصفحات المكتملة ما زالت في المعاينة.";}
 }
 session->thread=0;CoDisableCallCancellation(nullptr);CoUninitialize();
 if(session->cancelled)finished.cancelled=true;Post(session,std::move(finished));
}
}

struct ScannerBridge::Impl {
 std::unique_ptr<flutter::MethodChannel<Value>> channel;
 std::unique_ptr<flutter::MethodResult<Value>> pending;
 std::shared_ptr<Session> session;HWND dispatcher=nullptr;HWND owner=nullptr;bool busy=false;
 Impl(flutter::BinaryMessenger* messenger,HWND parent):owner(parent){
  WNDCLASSW type{};type.lpfnWndProc=WindowProc;type.hInstance=GetModuleHandleW(nullptr);type.lpszClassName=kDispatcherClass;RegisterClassW(&type);
  dispatcher=CreateWindowExW(0,kDispatcherClass,L"",0,0,0,0,0,HWND_MESSAGE,nullptr,type.hInstance,this);
  channel=std::make_unique<flutter::MethodChannel<Value>>(messenger,"com.beyond/scanner",&flutter::StandardMethodCodec::GetInstance());
  channel->SetMethodCallHandler([this](const auto& call,auto result){
   if(call.method_name()=="cancel"){
    const auto* args=call.arguments()?std::get_if<Map>(call.arguments()):nullptr;
    if(args&&session){const auto id=args->find(Value("sessionId"));if(id!=args->end()&&std::holds_alternative<std::string>(id->second)&&std::get<std::string>(id->second)==session->id)Cancel();}
    result->Success();return;
   }
   if(call.method_name()!="scan"){result->NotImplemented();return;}
   if(busy){result->Error("SCAN_BUSY","جلسة المسح ما زالت تعمل.");return;}
   const auto* arguments=call.arguments()?std::get_if<Map>(call.arguments()):nullptr;
   if(!dispatcher||!arguments){result->Error("SCAN_ARGUMENTS","تعذر بدء جلسة المسح.");return;}
   const auto id=arguments->find(Value("sessionId")),maximum=arguments->find(Value("maxPages"));
   if(id==arguments->end()||maximum==arguments->end()||!std::holds_alternative<std::string>(id->second)||!std::holds_alternative<int32_t>(maximum->second)){result->Error("SCAN_ARGUMENTS","بيانات جلسة المسح غير صالحة.");return;}
   const int limit=std::get<int32_t>(maximum->second);if(limit<1||limit>50){result->Error("SCAN_LIMIT","الحد الأقصى للدفعة 50 فاتورة.");return;}
   session=std::make_shared<Session>();session->id=std::get<std::string>(id->second);session->max_pages=limit;session->dispatcher=dispatcher;busy=true;pending=std::move(result);
   ComPtr<IWiaDevMgr2> manager;ComPtr<IWiaItem2> root;BSTR device_id=nullptr;
   HRESULT hr=CoCreateInstance(CLSID_WiaDevMgr2,nullptr,CLSCTX_LOCAL_SERVER,IID_PPV_ARGS(&manager));
   if(SUCCEEDED(hr))hr=manager->SelectDeviceDlg(owner,1,WIA_SELECT_DEVICE_NODEFAULT,&device_id,&root);
   if(hr==S_FALSE||hr==HRESULT_FROM_WIN32(ERROR_CANCELLED)){SysFreeString(device_id);ScanEvent done;done.done=true;done.cancelled=true;Complete(done);return;}
   if(FAILED(hr)||!root||!device_id){SysFreeString(device_id);ScanEvent done;done.done=true;done.warning="لم يتم العثور على ماسح متاح. تحقق من تشغيله وتثبيت تعريف WIA الخاص به.";Complete(done);return;}
   std::wstring selected(device_id);SysFreeString(device_id);
   root.Reset();manager.Reset();
   try{std::thread([state=session,id=std::move(selected)]{Worker(state,id);}).detach();}
   catch(...){ScanEvent done;done.done=true;done.warning="تعذر بدء جلسة المسح.";Complete(done);}
  });
 }
 ~Impl(){
  Cancel();if(session){std::lock_guard<std::mutex> lock(session->mutex);session->closed=true;session->events.clear();session->condition.notify_all();}
  if(channel)channel->SetMethodCallHandler(nullptr);if(dispatcher)DestroyWindow(dispatcher);pending.reset();
 }
 void Cancel(){if(!session)return;session->cancelled=true;session->condition.notify_all();const DWORD thread=session->thread;if(thread)CoCancelCall(thread,0);}
 void Complete(const ScanEvent& done){
  if(!pending)return;busy=false;
  pending->Success(Value(Map{{Value("pages"),Value(done.page)},{Value("warning"),Value(done.warning)},{Value("cancelled"),Value(done.cancelled)},{Value("feeder"),Value(done.feeder)}}));pending.reset();
 }
 void Drain(){
  if(!session)return;const auto state=session;std::deque<ScanEvent> events;
  {std::lock_guard<std::mutex> lock(state->mutex);events.swap(state->events);}
  for(auto& event:events){
   if(event.done){Complete(event);continue;}
   const int index=event.page;
   auto acknowledge=[state,index](bool accepted){std::lock_guard<std::mutex> lock(state->mutex);if(accepted)state->acknowledged=std::max(state->acknowledged,index);else{state->delivery_failed=true;state->cancelled=true;}state->condition.notify_all();};
   channel->InvokeMethod("page",std::make_unique<Value>(Map{{Value("sessionId"),Value(state->id)},{Value("index"),Value(index)},{Value("bytes"),Value(std::move(event.bytes))}}),
    std::make_unique<flutter::MethodResultFunctions<Value>>(
     [acknowledge](const Value* result){acknowledge(result&&std::holds_alternative<bool>(*result)&&std::get<bool>(*result));},
     [acknowledge](const std::string&,const std::string&,const Value*){acknowledge(false);},
     [acknowledge]{acknowledge(false);}));
  }
 }
 static LRESULT CALLBACK WindowProc(HWND window,UINT message,WPARAM wparam,LPARAM lparam){
  if(message==WM_NCCREATE){auto* create=reinterpret_cast<CREATESTRUCTW*>(lparam);SetWindowLongPtrW(window,GWLP_USERDATA,reinterpret_cast<LONG_PTR>(create->lpCreateParams));}
  auto* self=reinterpret_cast<Impl*>(GetWindowLongPtrW(window,GWLP_USERDATA));
  if(message==kScanMessage&&self){self->Drain();return 0;}
  return DefWindowProcW(window,message,wparam,lparam);
 }
};
ScannerBridge::ScannerBridge(flutter::BinaryMessenger* messenger,HWND owner):impl_(std::make_unique<Impl>(messenger,owner)){}
ScannerBridge::~ScannerBridge()=default;
std::unique_ptr<ScannerBridge> RegisterScanner(flutter::BinaryMessenger* messenger,HWND owner){return std::make_unique<ScannerBridge>(messenger,owner);}
