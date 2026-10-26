# Backend 0.2.0: trạng thái kiểm chứng

Backend là một triển khai mới từ hợp đồng client public `game-20261025-1758`.
Không có mã nguồn máy chủ private. Những quy tắc dưới đây thuộc bản tự host.

| Hệ thống | Đã chạy | Giới hạn còn lại |
|---|---|---|
| Tài khoản | Device/custom, email với scrypt, HMAC access/refresh, logout, restart | Chưa có khôi phục mật khẩu/email xác nhận hay công cụ quản trị |
| World | Ba kênh, map chung, snapshot 10Hz, kiểm tra match, seq/ack, reconnect | Một tiến trình, full snapshot, chưa có interest management/va chạm layout đầy đủ |
| Chiến đấu | Tầm đánh, cooldown, SP, chí mạng, heal/shield, poison/freeze cơ bản, AI, respawn | Nhiều kỹ năng dùng damage handler chung, chưa có toàn bộ hiệu ứng/phases riêng |
| Nhân vật | EXP/Job EXP, level, stats, skill points, prerequisites, nghề theo cây danh mục | Các nội tại/bộ trang bị và điều kiện thử thách nâng cao chưa đủ |
| Đồ | Copy ID server, ownership, bag/store, refine/grade/options, drop, craft/buy/sell | Công thức độc lập; chưa phục dựng tất cả công thức/minigame gốc |
| Nhiệm vụ | Bốn bước kill → gather → job → dungeon; lựa chọn/danh vọng lưu bền | Chưa có toàn bộ nội dung/hội thoại gốc |
| Phụ bản | Instance đơn, boss, clear/claim/exit, không lặp thưởng, boss HP lưu theo tick | Chưa có các tầng, party dungeon, checkpoint và script riêng của bản gốc |
| Đời sống | Resource allowlist theo map, 3 giây/lượt; farm 60 giây; cook/eat/brew | Không mô phỏng đầy đủ minigame câu cá/cây/quặng gốc |
| Hằng ngày | Điểm danh theo UTC, 5 kills thưởng ngày | Chưa có chuỗi tuần/tháng đầy đủ và AUTO khi offline |
| Social | Party invite/accept/kick/leave, chia EXP gần; friend accept/remove; bang/coffer/notice; chat map | Chat bang/party, shared bank và guild-war chưa có |
| Chợ | List/buy/unlist, ownership, 5% phí, rollback | Chưa có vend/gacha/economy mùa của bản gốc |
| PvP | Invite/accept 30 giây, trận tối đa 120 giây, kết thúc tại 1 HP | Chưa có arena xếp hạng/ghép trận tự động |
| Triển khai | Node, Docker, Caddy HTTPS, web/API/WS cùng origin, health endpoint, atomic save | Chưa stress test nhiều người, chưa có PostgreSQL hay multi-replica |

Lệnh chưa hỗ trợ trả lỗi rõ ràng để client khôi phục từ snapshot; không giả trả
thành công. Snapshot chỉ công bố danh tính/ngoại hình/HP của người chơi khác,
không công bố túi, kho hoặc thông tin tài khoản của họ.

## Xác minh

`npm test` trong `server/`: 17 test qua, bao gồm test HTTP + hai WebSocket trên
port tạm với DATA_DIR riêng; gửi lệnh lặp, lệnh sai, mật khẩu sai, token sửa chữ
ký, rồi tắt/khởi động lại tiến trình để kiểm tra tài khoản và tài nguyên còn nguyên.
Test trạng thái dùng đồng hồ giả để kiểm tra timeout và phần thưởng không phụ
thuộc tốc độ máy. Chúng không chứng minh chịu tải 150 người hay tính tương đương
với backend gốc.

Chromium thực: đăng nhập, tạo nhân vật, vào map, mua bình HP bằng bảng tiếng
Việt, thu thập chờ đủ thời gian và nhận nguyên liệu; không có page error hay
request HTTP lỗi trong luồng này. Docker image Node 22 build thành công; container
trả health 200 và phục vụ nhạc nền từ kho asset đầy đủ.

Các snapshot test trong `server/data/` được giữ lại theo yêu cầu lưu toàn bộ file
trước đây. Server mới mặc định tạo `server/runtime/` riêng, không dùng tài khoản
test đã công bố làm người chơi production.
