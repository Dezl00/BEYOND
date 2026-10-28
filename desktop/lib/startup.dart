import 'package:flutter/services.dart';

const startupChannel = MethodChannel('com.beyond/startup');

Future<bool> notifyNativeReady() async {
  try {
    await startupChannel.invokeMethod<void>('ready');
    return true;
  } on MissingPluginException {
    return false;
  } on PlatformException {
    return false;
  }
}
