#ifndef BEYOND_SCANNER_TRANSFER_H_
#define BEYOND_SCANNER_TRANSFER_H_
#include <windows.h>
#include <wia.h>
#include <cstdint>
#include <functional>
#include <vector>
namespace beyond {
enum class ScanStop { complete, cancelled, limit, failed, oversized };
struct ScanOptions {
 int max_pages=50;
 uint64_t max_page_bytes=25*1024*1024;
 bool feeder=true;
 std::function<bool()> cancelled;
 std::function<bool(std::vector<uint8_t>&&)> publish;
};
struct ScanOutcome {int pages=0;ScanStop stop=ScanStop::complete;HRESULT error=S_OK;};
using Download=std::function<HRESULT(IWiaTransferCallback*,int)>;
ScanOutcome TransferPages(const ScanOptions& options,const Download& download);
}
#endif
