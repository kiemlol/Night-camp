# Cutout Playground

Demo độc lập: ảnh Traveler sáu bộ phận + kiếm + dữ liệu rig + bốn clip
idle/walk/run/attack + renderer cutout. Không cần Node backend Night Camp,
không tải script hoặc ảnh từ thư mục client gốc và không gọi API game.

Chạy từ riêng thư mục này bằng một static HTTP server, ví dụ:

```sh
python3 -m http.server 8080
```

Mở http://localhost:8080/. Không mở index.html bằng file:// vì trình duyệt cần
HTTP để đọc module và file nhân vật JSON. Có thể upload nguyên thư mục này lên
static hosting. Link sang Studio chỉ hoạt động khi host cùng repo đầy đủ.

Trong repo Night-camp, chạy server như bình thường rồi mở /cutout-demo/.

Điều khiển: A/D hoặc phím mũi tên; Shift chạy; Space đánh. Nút trên màn hình
hỗ trợ giữ bằng cảm ứng. Di chuyển tới hình nộm rồi đánh để kiểm tra thời điểm
hit của clip. Checkbox hiện khớp giúp xem rig; có thể ẩn kiếm.

Chọn slot đi/đứng/chạy/đánh, mở .cutout.json hoặc .game-bundle.json xuất từ
Studio để thay rig và clip tương ứng. Những clip khác dùng mẫu Traveler.
File được đọc như dữ liệu JSON, không thực thi trường code trong bundle.
Ảnh import nhúng data URL hoạt động trực tiếp. Ảnh thư viện gốc chỉ được tham
chiếu, nên phải copy ảnh vào assets/ theo đường dẫn trong project nếu khác
sáu ảnh Traveler được đóng gói sẵn. Thay đổi trên demo không lưu vào game.

`runtime/player.mjs` cung cấp CutoutPlayer.load(spec), play(name), update(dt,
onHit) và draw(context,x,y,scale,options). Thời gian tính bằng giây. Nạp
runtime/bootstrap.js và runtime/avatar.js trước khi import player.mjs.
`traveler.character.json` là ví dụ về định dạng nhiều clip; chuyển động đã được
lấy mẫu thành keyframe, không cần anim.js hay poselib.js lúc chạy.

Demo dùng renderer cutout hiện có cho cấu trúc sáu bộ phận. Chưa có editor
mesh/Spine, gameplay RPG, networking hoặc chiến đấu với quái. Asset mẫu giữ
nguyên quyền sở hữu của tác giả gốc; việc đóng gói demo không cấp quyền mới.

Tái tạo file nhân vật/ảnh/runtime từ gốc bằng tools/build-cutout-demo.mjs ở
repo cha. Tool này giữ nguyên các file demo viết tay.
