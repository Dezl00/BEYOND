#ifndef BEYOND_SCANNER_BRIDGE_H_
#define BEYOND_SCANNER_BRIDGE_H_
#include <windows.h>
#include <flutter/binary_messenger.h>
#include <flutter/method_channel.h>
#include <flutter/standard_method_codec.h>
#include <memory>
class ScannerBridge {
 public:
 ScannerBridge(flutter::BinaryMessenger* messenger,HWND owner);
 ~ScannerBridge();
 ScannerBridge(const ScannerBridge&)=delete;
 ScannerBridge& operator=(const ScannerBridge&)=delete;
 private:
 struct Impl;std::unique_ptr<Impl> impl_;
};
std::unique_ptr<ScannerBridge> RegisterScanner(flutter::BinaryMessenger* messenger,HWND owner);
#endif
