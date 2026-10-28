#include "flutter_window.h"

#include <optional>

#include "flutter/generated_plugin_registrant.h"

namespace {constexpr UINT_PTR kStartupTimer = 0xBE01;}

FlutterWindow::FlutterWindow(const flutter::DartProject& project, bool verify_startup)
    : verify_startup_(verify_startup), project_(project) {}

FlutterWindow::~FlutterWindow() {}

bool FlutterWindow::OnCreate() {
  if (!Win32Window::OnCreate()) {
    return false;
  }

  RECT frame = GetClientArea();

  // The size here must match the window dimensions to avoid unnecessary surface
  // creation / destruction in the startup path.
  flutter_controller_ = std::make_unique<flutter::FlutterViewController>(
      frame.right - frame.left, frame.bottom - frame.top, project_);
  // Ensure that basic setup of the controller was successful.
  if (!flutter_controller_->engine() || !flutter_controller_->view()) {
    return false;
  }
  startup_channel_ = std::make_unique<flutter::MethodChannel<flutter::EncodableValue>>(
      flutter_controller_->engine()->messenger(), "com.beyond/startup",
      &flutter::StandardMethodCodec::GetInstance());
  startup_channel_->SetMethodCallHandler([this](const auto& call, auto result) {
    if (call.method_name() != "ready") {result->NotImplemented();return;}
    dart_ready_ = true;
    result->Success();
    FinishStartup();
  });
  SetTimer(GetHandle(), kStartupTimer, 20000, nullptr);
  RegisterPlugins(flutter_controller_->engine());
  scanner_channel_ = RegisterScanner(flutter_controller_->engine()->messenger(), GetHandle());
  SetChildContent(flutter_controller_->view()->GetNativeWindow());

  flutter_controller_->engine()->SetNextFrameCallback([&]() {
    first_frame_ = true;
    if (!verify_startup_) this->Show();
    FinishStartup();
  });

  // Flutter can complete the first frame before the "show window" callback is
  // registered. The following call ensures a frame is pending to ensure the
  // window is shown. It is a no-op if the first frame hasn't completed yet.
  flutter_controller_->ForceRedraw();

  return true;
}

void FlutterWindow::FinishStartup() {
  if (!first_frame_ || !dart_ready_) return;
  KillTimer(GetHandle(), kStartupTimer);
  if (verify_startup_) PostMessage(GetHandle(), WM_CLOSE, 0, 0);
}

void FlutterWindow::OnDestroy() {
  if (GetHandle()) KillTimer(GetHandle(), kStartupTimer);
  startup_channel_.reset();
  scanner_channel_.reset();
  if (flutter_controller_) {
    flutter_controller_ = nullptr;
  }

  Win32Window::OnDestroy();
}

LRESULT
FlutterWindow::MessageHandler(HWND hwnd, UINT const message,
                              WPARAM const wparam,
                              LPARAM const lparam) noexcept {
  // Give Flutter, including plugins, an opportunity to handle window messages.
  if (flutter_controller_) {
    std::optional<LRESULT> result =
        flutter_controller_->HandleTopLevelWindowProc(hwnd, message, wparam,
                                                      lparam);
    if (result) {
      return *result;
    }
  }

  switch (message) {
    case WM_TIMER:
      if (wparam == kStartupTimer) {
        KillTimer(hwnd, kStartupTimer);
        if (!verify_startup_) MessageBoxW(hwnd, L"تعذر إظهار واجهة البرنامج. استخدم حزمة Beyond الخاصة بالتوافق مع Windows 10 وتحقق من تعريف كارت الشاشة.", L"Beyond", MB_OK | MB_ICONERROR);
        PostQuitMessage(2);
        return 0;
      }
      break;
    case WM_GETMINMAXINFO: {
      const UINT dpi = GetDpiForWindow(hwnd);
      auto* limits = reinterpret_cast<MINMAXINFO*>(lparam);
      limits->ptMinTrackSize.x = MulDiv(900, dpi, 96);
      limits->ptMinTrackSize.y = MulDiv(620, dpi, 96);
      return 0;
    }
    case WM_FONTCHANGE:
      if (flutter_controller_) flutter_controller_->engine()->ReloadSystemFonts();
      break;
  }

  return Win32Window::MessageHandler(hwnd, message, wparam, lparam);
}
