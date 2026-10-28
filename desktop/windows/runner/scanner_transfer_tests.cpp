#include "scanner_transfer.h"
#include <objidl.h>
#include <wrl/client.h>
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
using Microsoft::WRL::ComPtr;
using beyond::ScanOptions;using beyond::ScanStop;
namespace {
void Require(bool condition,const char* message){if(!condition)throw std::runtime_error(message);}
HRESULT Page(IWiaTransferCallback* callback,const std::vector<uint8_t>& bytes,bool finish=true){
 ComPtr<IStream> stream;HRESULT hr=callback->GetNextStream(0,nullptr,nullptr,&stream);if(hr!=S_OK)return hr;
 ULONG written=0;hr=stream->Write(bytes.data(),static_cast<ULONG>(bytes.size()),&written);if(FAILED(hr))return hr;
 if(!finish)return S_OK;WiaTransferParams message{};message.lMessage=WIA_TRANSFER_MSG_END_OF_STREAM;return callback->TransferCallback(0,&message);
}
}
int main(){
 CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
 try{
  int checks=0;std::vector<std::vector<uint8_t>> pages;ScanOptions options;
  options.publish=[&](std::vector<uint8_t>&& bytes){pages.push_back(std::move(bytes));return true;};
  {int calls=0;auto result=beyond::TransferPages(options,[&](IWiaTransferCallback* callback,int remaining){calls++;Require(remaining==50,"wrong remaining capacity");for(int n=0;n<3;n++){HRESULT hr=Page(callback,{static_cast<uint8_t>(n+1),2,3});if(hr!=S_OK)return hr;}return WIA_ERROR_PAPER_EMPTY;});Require(result.pages==3&&pages.size()==3&&calls==1&&result.stop==ScanStop::complete,"all-pages session failed");Require(pages[0][0]==1&&pages[2][0]==3,"page order changed");checks++;}
  pages.clear();{int calls=0;auto result=beyond::TransferPages(options,[&](IWiaTransferCallback* callback,int remaining){calls++;Require(remaining==51-calls,"remaining capacity did not decrease");if(calls<=4)return Page(callback,{1,2,3});return WIA_ERROR_PAPER_EMPTY;});Require(result.pages==4&&calls==5&&result.stop==ScanStop::complete,"single-page driver did not continue until tray empty");checks++;}
  pages.clear();{auto result=beyond::TransferPages(options,[](IWiaTransferCallback*,int){return WIA_ERROR_PAPER_EMPTY;});Require(result.pages==0&&result.stop==ScanStop::complete,"empty feeder treated as a fatal driver error");checks++;}
  pages.clear();{int calls=0;auto result=beyond::TransferPages(options,[&](IWiaTransferCallback* callback,int){calls++;if(calls==1)return Page(callback,{1,2,3});Page(callback,{9,9},false);return WIA_ERROR_PAPER_JAM;});Require(result.pages==1&&pages.size()==1&&result.stop==ScanStop::failed&&result.error==WIA_ERROR_PAPER_JAM,"jam discarded completed pages or retained incomplete page");checks++;}
  pages.clear();{bool cancelled=false;auto cancelledOptions=options;cancelledOptions.cancelled=[&]{return cancelled;};cancelledOptions.publish=[&](std::vector<uint8_t>&& bytes){pages.push_back(std::move(bytes));cancelled=true;return true;};auto result=beyond::TransferPages(cancelledOptions,[](IWiaTransferCallback* callback,int){return Page(callback,{1,2});});Require(result.pages==1&&pages.size()==1&&result.stop==ScanStop::cancelled,"cancel did not preserve completed pages");checks++;}
  pages.clear();{auto limited=options;limited.max_pages=2;int requests=0;auto result=beyond::TransferPages(limited,[&](IWiaTransferCallback* callback,int){for(int n=0;n<6;n++){HRESULT hr=Page(callback,{1,2});if(hr!=S_OK)return hr;requests++;}return S_OK;});Require(result.pages==2&&pages.size()==2&&requests==1&&result.stop==ScanStop::limit,"batch limit over-consumed pages");checks++;}
  pages.clear();{auto bounded=options;bounded.max_page_bytes=4;auto result=beyond::TransferPages(bounded,[](IWiaTransferCallback* callback,int){return Page(callback,{1,2,3,4,5});});Require(result.pages==0&&pages.empty()&&result.stop==ScanStop::oversized,"oversized stream was not stopped before allocation");checks++;}
  pages.clear();{auto flatbed=options;flatbed.feeder=false;int calls=0;auto result=beyond::TransferPages(flatbed,[&](IWiaTransferCallback* callback,int){calls++;return Page(callback,{1,2,3},false);});Require(result.pages==1&&pages.size()==1&&calls==1,"flatbed repeated automatically or final successful stream was lost");checks++;}
  pages.clear();{auto result=beyond::TransferPages(options,[](IWiaTransferCallback*,int){return S_OK;});Require(result.pages==0&&result.stop==ScanStop::complete,"empty successful driver response did not stop normally");checks++;}
  pages.clear();{auto result=beyond::TransferPages(options,[](IWiaTransferCallback* callback,int){ComPtr<IStream> stream;HRESULT hr=callback->GetNextStream(0,nullptr,nullptr,&stream);if(hr!=S_OK)return hr;const uint8_t original[3]={1,2,3};ULONG written=0;hr=stream->Write(original,3,&written);if(FAILED(hr))return hr;LARGE_INTEGER start{};hr=stream->Seek(start,STREAM_SEEK_SET,nullptr);if(FAILED(hr))return hr;const uint8_t header=7;return stream->Write(&header,1,&written);});auto first=pages.front();Require(first==std::vector<uint8_t>({7,2,3}),"scanner could not patch image header in memory");Require(result.pages==50&&result.stop==ScanStop::limit,"header stream test did not stop at limit");checks++;}
  std::cout<<checks<<" native scanner transfer checks passed\n";CoUninitialize();return EXIT_SUCCESS;
 }catch(const std::exception& error){std::cerr<<error.what()<<"\n";CoUninitialize();return EXIT_FAILURE;}
}
