#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <windows.h>
#include <algorithm>
#include <filesystem>
#include <vector>
#include "flutter_window.h"
#include "utils.h"

namespace {
std::filesystem::path DataDirectory() {
 std::vector<wchar_t> path(32768);
 const DWORD size=GetModuleFileNameW(nullptr,path.data(),static_cast<DWORD>(path.size()));
 if(!size||size>=path.size())return {};
 return std::filesystem::path(std::wstring(path.data(),size)).parent_path()/L"data";
}
bool HasRuntimeFiles(const std::filesystem::path& data) {
 if(data.empty())return false;
 std::error_code error;
 for(const auto& file:{data/L"icudtl.dat",data/L"app.so",data/L"flutter_assets"/L"AssetManifest.bin",data/L"flutter_assets"/L"assets"/L"runtime.json"}) {
  if(!std::filesystem::is_regular_file(file,error)||error)return false;
 }
 return true;
}
}
int APIENTRY wWinMain(_In_ HINSTANCE instance,_In_opt_ HINSTANCE prev,
                      _In_ wchar_t* command_line,_In_ int show_command) {
 if(!::AttachConsole(ATTACH_PARENT_PROCESS)&&::IsDebuggerPresent())CreateAndAttachConsole();
 auto arguments=GetCommandLineArguments();
 const bool verify=std::find(arguments.begin(),arguments.end(),"--verify-startup")!=arguments.end();
 arguments.erase(std::remove(arguments.begin(),arguments.end(),"--verify-startup"),arguments.end());
 const auto data=DataDirectory();
 if(!HasRuntimeFiles(data)) {
  if(!verify)MessageBoxW(nullptr,L"ملفات تشغيل Beyond غير مكتملة. فك ضغط الحزمة بالكامل وشغّل Beyond.exe من داخل المجلد مع مجلد data وملفات DLL.",L"Beyond",MB_OK|MB_ICONERROR);
  return 3;
 }
 const HRESULT initialized=::CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
 if(FAILED(initialized))return 4;
 flutter::DartProject project(data.wstring());
 // Keep WIA's modal driver dialog independent of the Flutter UI isolate.
 project.set_ui_thread_policy(flutter::UIThreadPolicy::RunOnSeparateThread);
 project.set_dart_entrypoint_arguments(std::move(arguments));
 FlutterWindow window(project,verify);
 Win32Window::Point origin(60,40);Win32Window::Size size(1440,900);
 if(!window.Create(L"Beyond",origin,size)) {
  if(!verify)MessageBoxW(nullptr,L"تعذر بدء واجهة Beyond. تحقق من اكتمال ملفات التشغيل وتعريف كارت الشاشة.",L"Beyond",MB_OK|MB_ICONERROR);
  ::CoUninitialize();return 5;
 }
 window.SetQuitOnClose(true);
 ::MSG msg{};BOOL status;
 while((status=::GetMessage(&msg,nullptr,0,0))>0){::TranslateMessage(&msg);::DispatchMessage(&msg);}
 ::CoUninitialize();
 return status<0?EXIT_FAILURE:static_cast<int>(msg.wParam);
}
