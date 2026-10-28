#include "scanner_transfer.h"
#include <objidl.h>
#include <wrl/client.h>
#include <atomic>
#include <memory>
#include <utility>
namespace beyond {
namespace {
using Microsoft::WRL::ComPtr;
class MemoryPage final:public IStream {
 public:
 MemoryPage(ComPtr<IStream> inner,uint64_t maximum,std::shared_ptr<std::atomic_bool> oversized):inner_(std::move(inner)),maximum_(maximum),oversized_(std::move(oversized)){}
 HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid,void** object) override {
  if(!object)return E_POINTER;*object=nullptr;
  if(iid==IID_IUnknown||iid==IID_IStream||iid==IID_ISequentialStream){*object=static_cast<IStream*>(this);AddRef();return S_OK;}return E_NOINTERFACE;
 }
 ULONG STDMETHODCALLTYPE AddRef() override{return ++refs_;}
 ULONG STDMETHODCALLTYPE Release() override{const ULONG refs=--refs_;if(!refs)delete this;return refs;}
 HRESULT STDMETHODCALLTYPE Read(void* bytes,ULONG count,ULONG* read) override{return inner_->Read(bytes,count,read);}
 HRESULT STDMETHODCALLTYPE Write(const void* bytes,ULONG count,ULONG* written) override {
  if(written)*written=0;LARGE_INTEGER zero{};ULARGE_INTEGER position{};
  HRESULT hr=inner_->Seek(zero,STREAM_SEEK_CUR,&position);if(FAILED(hr))return hr;
  if(position.QuadPart>maximum_||count>maximum_-position.QuadPart){*oversized_=true;return STG_E_MEDIUMFULL;}
  return inner_->Write(bytes,count,written);
 }
 HRESULT STDMETHODCALLTYPE Seek(LARGE_INTEGER move,DWORD origin,ULARGE_INTEGER* position) override {
  LARGE_INTEGER zero{};ULARGE_INTEGER current{};STATSTG stat{};uint64_t base=0;
  if(origin==STREAM_SEEK_CUR){HRESULT hr=inner_->Seek(zero,STREAM_SEEK_CUR,&current);if(FAILED(hr))return hr;base=current.QuadPart;}
  else if(origin==STREAM_SEEK_END){HRESULT hr=inner_->Stat(&stat,STATFLAG_NONAME);if(FAILED(hr))return hr;base=stat.cbSize.QuadPart;}
  else if(origin!=STREAM_SEEK_SET)return STG_E_INVALIDFUNCTION;
  if(move.QuadPart<0&&static_cast<uint64_t>(-(move.QuadPart+1))+1>base)return STG_E_INVALIDFUNCTION;
  if(move.QuadPart>=0&&static_cast<uint64_t>(move.QuadPart)>maximum_-base){*oversized_=true;return STG_E_MEDIUMFULL;}
  const uint64_t target=move.QuadPart<0?base-(static_cast<uint64_t>(-(move.QuadPart+1))+1):base+static_cast<uint64_t>(move.QuadPart);
  if(target>maximum_){*oversized_=true;return STG_E_MEDIUMFULL;}
  LARGE_INTEGER absolute{};absolute.QuadPart=static_cast<LONGLONG>(target);return inner_->Seek(absolute,STREAM_SEEK_SET,position);
 }
 HRESULT STDMETHODCALLTYPE SetSize(ULARGE_INTEGER size) override{if(size.QuadPart>maximum_){*oversized_=true;return STG_E_MEDIUMFULL;}return inner_->SetSize(size);}
 HRESULT STDMETHODCALLTYPE CopyTo(IStream* stream,ULARGE_INTEGER count,ULARGE_INTEGER* read,ULARGE_INTEGER* written) override{return inner_->CopyTo(stream,count,read,written);}
 HRESULT STDMETHODCALLTYPE Commit(DWORD flags) override{return inner_->Commit(flags);}
 HRESULT STDMETHODCALLTYPE Revert() override{return inner_->Revert();}
 HRESULT STDMETHODCALLTYPE LockRegion(ULARGE_INTEGER offset,ULARGE_INTEGER count,DWORD type) override{return inner_->LockRegion(offset,count,type);}
 HRESULT STDMETHODCALLTYPE UnlockRegion(ULARGE_INTEGER offset,ULARGE_INTEGER count,DWORD type) override{return inner_->UnlockRegion(offset,count,type);}
 HRESULT STDMETHODCALLTYPE Stat(STATSTG* stat,DWORD flags) override{return inner_->Stat(stat,flags);}
 HRESULT STDMETHODCALLTYPE Clone(IStream** stream) override{
  if(!stream)return E_POINTER;*stream=nullptr;ComPtr<IStream> clone;HRESULT hr=inner_->Clone(&clone);if(FAILED(hr))return hr;*stream=new MemoryPage(std::move(clone),maximum_,oversized_);return S_OK;
 }
 private:
 std::atomic<ULONG> refs_{1};ComPtr<IStream> inner_;uint64_t maximum_;std::shared_ptr<std::atomic_bool> oversized_;
};
class BatchCallback final:public IWiaTransferCallback {
 public:
 explicit BatchCallback(const ScanOptions& options):options_(options){}
 HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid,void** object) override {
  if(!object)return E_POINTER;*object=nullptr;if(iid==IID_IUnknown||iid==__uuidof(IWiaTransferCallback)){*object=static_cast<IWiaTransferCallback*>(this);AddRef();return S_OK;}return E_NOINTERFACE;
 }
 ULONG STDMETHODCALLTYPE AddRef() override{return ++refs_;}
 ULONG STDMETHODCALLTYPE Release() override{const ULONG refs=--refs_;if(!refs)delete this;return refs;}
 bool Cancelled() const{return options_.cancelled&&options_.cancelled();}
 HRESULT STDMETHODCALLTYPE GetNextStream(LONG,BSTR,BSTR,IStream** stream) override {
  if(!stream)return E_POINTER;*stream=nullptr;
  if(Cancelled()){outcome.stop=ScanStop::cancelled;return S_FALSE;}
  if(current_){HRESULT hr=FinishPage();if(hr!=S_OK)return hr;}
  if(outcome.pages>=options_.max_pages){outcome.stop=ScanStop::limit;return S_FALSE;}
  ComPtr<IStream> memory;HRESULT hr=CreateStreamOnHGlobal(nullptr,TRUE,&memory);if(FAILED(hr))return hr;
  current_.Attach(new MemoryPage(std::move(memory),options_.max_page_bytes,oversized_));
  *stream=current_.Get();(*stream)->AddRef();return S_OK;
 }
 HRESULT STDMETHODCALLTYPE TransferCallback(LONG,WiaTransferParams* params) override {
  if(Cancelled()){outcome.stop=ScanStop::cancelled;return S_FALSE;}
  if(params&&params->lMessage==WIA_TRANSFER_MSG_END_OF_STREAM)return FinishPage();
  return S_OK;
 }
 HRESULT FinishPage(){
  if(!current_)return S_OK;
  if(Cancelled()){current_.Reset();outcome.stop=ScanStop::cancelled;return S_FALSE;}
  STATSTG stat{};HRESULT hr=current_->Stat(&stat,STATFLAG_NONAME);
  if(FAILED(hr))return hr;if(!stat.cbSize.QuadPart){current_.Reset();return S_OK;}
  if(stat.cbSize.QuadPart>options_.max_page_bytes){*oversized_=true;return STG_E_MEDIUMFULL;}
  std::vector<uint8_t> bytes(static_cast<size_t>(stat.cbSize.QuadPart));LARGE_INTEGER zero{};
  hr=current_->Seek(zero,STREAM_SEEK_SET,nullptr);if(FAILED(hr))return hr;ULONG read=0;
  hr=current_->Read(bytes.data(),static_cast<ULONG>(bytes.size()),&read);current_.Reset();
  if(FAILED(hr)||read!=bytes.size())return STG_E_READFAULT;
  if(!options_.publish(std::move(bytes))){outcome.stop=ScanStop::cancelled;return S_FALSE;}
  outcome.pages++;if(outcome.pages>=options_.max_pages){outcome.stop=ScanStop::limit;return S_FALSE;}return S_OK;
 }
 void DiscardIncomplete(){current_.Reset();}
 bool Oversized() const{return oversized_->load();}
 ScanOutcome outcome;
 private:
 std::atomic<ULONG> refs_{1};ScanOptions options_;ComPtr<IStream> current_;std::shared_ptr<std::atomic_bool> oversized_=std::make_shared<std::atomic_bool>(false);
};
}
ScanOutcome TransferPages(const ScanOptions& options,const Download& download){
 ComPtr<BatchCallback> callback;callback.Attach(new BatchCallback(options));
 while(callback->outcome.pages<options.max_pages){
  if(callback->Cancelled()){callback->outcome.stop=ScanStop::cancelled;break;}
  const int before=callback->outcome.pages;
  const HRESULT hr=download(callback.Get(),options.max_pages-before);
  if(SUCCEEDED(hr)&&callback->outcome.stop==ScanStop::complete){
   const HRESULT completed=callback->FinishPage();
   if(FAILED(completed)){callback->outcome.stop=ScanStop::failed;callback->outcome.error=completed;}
  }else callback->DiscardIncomplete();
  if(callback->Oversized()){callback->outcome.stop=ScanStop::oversized;callback->outcome.error=STG_E_MEDIUMFULL;break;}
  if(callback->Cancelled())callback->outcome.stop=ScanStop::cancelled;
  if(callback->outcome.stop!=ScanStop::complete)break;
  if(hr==WIA_ERROR_PAPER_EMPTY)break;
  if(FAILED(hr)){callback->outcome.stop=ScanStop::failed;callback->outcome.error=hr;break;}
  if(!options.feeder)break;
  if(callback->outcome.pages==before)break;
 }
 return callback->outcome;
}
}
