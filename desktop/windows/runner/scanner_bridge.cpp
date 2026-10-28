#include "scanner_bridge.h"
#include <windows.h>
#include <oleauto.h>
#include <wrl/client.h>
#include <cstdint>
#include <vector>

namespace {
using Microsoft::WRL::ComPtr;
struct Variant {
 VARIANT value;
 Variant(){VariantInit(&value);}
 ~Variant(){VariantClear(&value);}
 Variant(const Variant&)=delete;
 Variant& operator=(const Variant&)=delete;
};
HRESULT Invoke(IDispatch* object,const wchar_t* name,WORD flags,VARIANT* args,UINT count,VARIANT* result){
 LPOLESTR member=const_cast<LPOLESTR>(name);DISPID id;
 HRESULT hr=object->GetIDsOfNames(IID_NULL,&member,1,LOCALE_USER_DEFAULT,&id);if(FAILED(hr))return hr;
 DISPPARAMS params={args,nullptr,count,0};EXCEPINFO info={};UINT badArg=0;
 hr=object->Invoke(id,IID_NULL,LOCALE_USER_DEFAULT,flags,&params,result,&info,&badArg);
 SysFreeString(info.bstrSource);SysFreeString(info.bstrDescription);SysFreeString(info.bstrHelpFile);return hr;
}
void Scan(std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result){
 CLSID clsid;HRESULT hr=CLSIDFromProgID(L"WIA.CommonDialog",&clsid);
 ComPtr<IDispatch> dialog;
 if(SUCCEEDED(hr))hr=CoCreateInstance(clsid,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&dialog));
 if(FAILED(hr)){result->Error("WIA_UNAVAILABLE","خدمة المسح الضوئي في Windows غير متاحة.");return;}
 // COM arguments are passed in reverse order. Acquire into ImageFile memory;
 // never invoke SaveFile, WIA's disk-based wizard, or a temporary directory.
 VARIANT args[7];for(auto& arg:args)VariantInit(&arg);
 args[6].vt=VT_I4;args[6].lVal=1; // ScannerDeviceType
 args[5].vt=VT_I4;args[5].lVal=1; // ColorIntent
 args[4].vt=VT_I4;args[4].lVal=65536; // MaximizeQuality
 args[3].vt=VT_BSTR;args[3].bstrVal=SysAllocString(L"{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}");
 args[2].vt=VT_BOOL;args[2].boolVal=VARIANT_TRUE; // Select scanner
 args[1].vt=VT_BOOL;args[1].boolVal=VARIANT_TRUE; // Driver/common native UI
 args[0].vt=VT_BOOL;args[0].boolVal=VARIANT_FALSE; // Cancel returns empty
 Variant image;hr=Invoke(dialog.Get(),L"ShowAcquireImage",DISPATCH_METHOD,args,7,&image.value);
 for(auto& arg:args)VariantClear(&arg);
 if(FAILED(hr)){
  if(hr==HRESULT_FROM_WIN32(ERROR_CANCELLED)){result->Success(flutter::EncodableValue(flutter::EncodableList{}));return;}
  result->Error("SCAN_FAILED","تعذر المسح. تحقق من توصيل الماسح وتعريف WIA وتشغيله.");return;
 }
 if(image.value.vt==VT_EMPTY||image.value.vt==VT_NULL){result->Success(flutter::EncodableValue(flutter::EncodableList{}));return;}
 if(image.value.vt!=VT_DISPATCH||!image.value.pdispVal){result->Error("SCAN_FORMAT","الماسح لم يُرجع صورة صالحة.");return;}
 Variant fileData;hr=Invoke(image.value.pdispVal,L"FileData",DISPATCH_PROPERTYGET,nullptr,0,&fileData.value);
 Variant binary;
 if(SUCCEEDED(hr)&&fileData.value.vt==VT_DISPATCH&&fileData.value.pdispVal)hr=Invoke(fileData.value.pdispVal,L"BinaryData",DISPATCH_PROPERTYGET,nullptr,0,&binary.value);
 else hr=E_FAIL;
 if(FAILED(hr)||binary.value.vt!=(VT_ARRAY|VT_UI1)||!binary.value.parray){result->Error("SCAN_BYTES","تعذر قراءة الصورة من الماسح.");return;}
 SAFEARRAY* data=binary.value.parray;LONG lower=0,upper=-1;
 if(SafeArrayGetDim(data)!=1||FAILED(SafeArrayGetLBound(data,1,&lower))||FAILED(SafeArrayGetUBound(data,1,&upper))||upper<lower){result->Error("SCAN_EMPTY","الصورة الممسوحة فارغة.");return;}
 const auto length=static_cast<size_t>(upper-lower)+1;
 if(length>25*1024*1024){result->Error("SCAN_TOO_LARGE","حجم المسح يتجاوز 25 ميجابايت. اختر دقة أقل وأعد المحاولة.");return;}
 void* ptr=nullptr;hr=SafeArrayAccessData(data,&ptr);
 if(FAILED(hr)||!ptr){result->Error("SCAN_BYTES","تعذر قراءة الصورة الممسوحة.");return;}
 const auto* bytes=static_cast<const uint8_t*>(ptr);
 std::vector<uint8_t> imageBytes(bytes,bytes+length);SafeArrayUnaccessData(data);
 flutter::EncodableList pages;pages.emplace_back(std::move(imageBytes));result->Success(flutter::EncodableValue(std::move(pages)));
}
}
std::unique_ptr<flutter::MethodChannel<flutter::EncodableValue>> RegisterScanner(flutter::BinaryMessenger* messenger){
 auto channel=std::make_unique<flutter::MethodChannel<flutter::EncodableValue>>(messenger,"com.beyond/scanner",&flutter::StandardMethodCodec::GetInstance());
 channel->SetMethodCallHandler([](const auto& call,auto result){
  if(call.method_name()=="scan")Scan(std::move(result));else result->NotImplemented();
 });
 return channel;
}
