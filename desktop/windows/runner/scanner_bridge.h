#ifndef BEYOND_SCANNER_BRIDGE_H_
#define BEYOND_SCANNER_BRIDGE_H_
#include <flutter/binary_messenger.h>
#include <flutter/method_channel.h>
#include <flutter/standard_method_codec.h>
#include <memory>
std::unique_ptr<flutter::MethodChannel<flutter::EncodableValue>> RegisterScanner(flutter::BinaryMessenger* messenger);
#endif
