# Night Camp — bản tự host

Client nền `v0.5.16` (`game-20261025-1758`) cùng backend Node.js `0.2.0` được
thiết kế độc lập. Server phục vụ cả trang game, asset, API và WebSocket trên
cùng một địa chỉ. Trạng thái chiến đấu, vật phẩm và tiến trình do server quyết định.

Repo GitHub hiện tại: <https://github.com/linhphann66-maker/Night-camp>.
Deployment Railway/VPS có thể dùng trực tiếp nhánh `main`.

## Chạy bằng Node.js 22 trở lên

```bash
git clone https://github.com/linhphann66-maker/Night-camp.git
cd Night-camp/server
npm ci
npm start
```

Mở **http://localhost:7350/**. Server tự mở đúng client online; không phải sửa
HTML hay tự thêm query string. Trong giao diện đăng nhập hiện có, nhập khóa cá
nhân dạng 20 chữ số: lần đầu tạo tài khoản, những lần sau dùng lại khóa đó.
Giữ khóa của bạn riêng tư; khóa này là thông tin đăng nhập của tài khoản đó.
Tạo nhân vật rồi vào game. Nút **Hành trang · Hệ thống** mở các tính năng tiếng Việt.

`server/runtime/` chứa tiến trình và khóa ký phiên, tự sinh khi chạy và không đưa
lên GitHub. `server/data/` là snapshot test cũ đã được lưu trước đó, không dùng làm
dữ liệu mặc định. Nếu cần giữ server cũ, đặt `DATA_DIR` tới thư mục dữ liệu cũ;
ID tài khoản device/custom cũ được nhận lại khi đăng nhập cùng khóa.
Với Docker server cũ dùng `server/data/`, đặt `DATA_PATH=./data` trong `.env`
trước khi rebuild để tiếp tục dùng dữ liệu cũ. `DATA_DIR` dùng cho chạy Node,
còn `DATA_PATH` chọn thư mục volume trên VPS khi chạy Docker.

## Deploy VPS bằng Docker

```bash
cd Night-camp/server
cp .env.example .env
```

Trong `.env`, đặt `PUBLIC_ORIGIN=http://IP-VPS:7350`, rồi chạy:

```bash
docker compose up -d --build
docker compose logs -f nightcamp
```

Mở `http://IP-VPS:7350/`. Với domain trỏ tới VPS, đặt `DOMAIN=game.example.com`
và `PUBLIC_ORIGIN=https://game.example.com` trong `.env`, rồi chạy:

```bash
docker compose --profile https up -d --build
```

Caddy phục vụ HTTPS và proxy WebSocket. VPS cần nhận kết nối cổng 80/443 cho
HTTPS, hoặc 7350 nếu thử bằng HTTP. Volume `server/runtime/` giữ dữ liệu qua
restart/rebuild. Sao lưu cả thư mục này; `.session-secret` giữ cho phiên đăng
nhập còn hợp lệ sau restart. Không chạy nhiều replica dùng chung file JSON.

## Cutout Studio v1

**Phụ kiện & vũ khí** trong cột trái: tìm/chọn mũ, tai nghe, kính hoặc vũ khí
từ các manifest public; bấm Gắn. Có thể tải PNG/WebP riêng. Chọn socket đỉnh
đầu/mặt/tay gần/tay xa, lớp trước/sau đầu hoặc bàn tay, kích thước, tỷ lệ, góc
và độ lệch. Bấm ảnh preview để đặt neo vành mũ/điểm cầm; bật Kéo phụ kiện để
dịch trực tiếp trên nhân vật. Mỗi project tối đa 32 phụ kiện. Vị trí mặc định
dựa theo metadata đeo/cầm có sẵn, không dùng AI suy đoán hình dạng. Bộ socket
đi theo rig khi xoay đầu, đổi pose, lật, scale và phát animation. Ảnh/dữ liệu
phụ kiện đi kèm project và bundle; demo đọc lại được. Khi tích hợp ở engine
khác, dùng renderer đi kèm để giữ socket và lớp vẽ; các clip tư thế và góc vũ
khí vẫn do người dùng chọn/chỉnh, không tự tạo animation cầm hai tay mới.

Tạo animation từ đầu và kế thừa pose:

- **Animation mới** tạo đúng một frame ở 0 giây, giữ rig/ảnh/tài nguyên. Chọn
  bắt đầu bằng tư thế đang chỉnh hoặc tư thế mặc định. Clip cũ có thể hoàn tác.
- **Thêm frame kế tiếp** tự lưu pose đang chỉnh của frame nguồn và tạo một
  bản sao độc lập ngay phía sau. Bước thời gian mặc định 0.1 giây, có thể đổi.
  Nếu chèn giữa clip, các frame phía sau dịch thêm một bước, không bị ghi đè.
- **Sao chép pose → nhiều frame** lấy tư thế đang hiển thị ở frame nguồn,
  cho chọn một/nhiều/tất cả frame đích. Chỉ pose thay đổi, giữ thời điểm và
  đường cong. Nguồn và từng bản sao không dùng chung tham chiếu dữ liệu.
- Các thao tác hỗ trợ undo/redo, lưu project và xuất bundle như trước. Vẫn có
  thể bấm **Ghi pose** để lưu riêng một frame mà không thêm frame mới.

Sửa thao tác rig và nhập ảnh tách mảnh:

- Kéo bàn tay/bàn chân để đặt đầu mút bằng IK; vòng màu cam ở khuỷu/gối chỉnh độ
  gập trực tiếp, không cần Shift. Vai/hông quay cả chi. Góc tính từ tư thế đầu
  thao tác, không cộng dồn theo sự kiện chạm. Canvas chặn chọn chữ/menu giữ chạm.
- Editor tắt hiệu chỉnh cầm kiếm tự động khi chỉnh tay. Khớp chân đi theo thân
  nghiêng; renderer hỗ trợ `overlap` để chồng mép ở vai/hông, cùng các điểm
  `elbow`/`knee` tùy chỉnh. Đổi kích thước ảnh đồng thời co giãn các điểm khớp.
- Tải ảnh PNG/WebP và bật **Tự cắt các mảnh rời**: Studio tìm các vùng tách nhau
  bằng alpha hoặc nền phẳng. Xem trước, lọc bụi/gộp vùng, chọn vai trò cho mảnh
  rồi lưu vào tài nguyên project hoặc gán cho đầu/thân/tay/chân. Không tự suy
  đoán giải phẫu hay cắt bộ phận còn dính liền. Ảnh phân tích thu về tối đa
  2048 px cạnh dài; chọn Trong suốt để giữ vùng trắng của hình khi cần.
- Bộ renderer riêng được tạo bởi `node tools/build-cutout-runtime.mjs`; dùng
  cùng renderer cho Studio và demo. Công cụ giải nén bundle kèm runtime này để
  các khớp và độ chồng mép được giữ khi tích hợp vào game khác.

Studio hỗ trợ đọc dữ liệu trực tiếp từ GitHub khi `window.STUDIO_GITHUB=true`.
Nút **Toàn bộ thư viện** duyệt hợp nhất file trong `dist-full/<build>` và
`dist/<build>`; tìm ảnh/map, nghe âm thanh, tải mã nguồn/rig, xem tên clip Spine.
Phần editor chỉ chỉnh rig cutout sáu bộ phận; rig Spine hiện xem dữ liệu/tải file.
Nút **Tải lại GitHub** kiểm tra commit mới và nạp lại danh mục/ảnh/pose, không ghi
ngược vào repo. Dữ liệu một phiên được ghim theo commit để tránh trộn phiên bản.
Nếu API GitHub giới hạn lượt, giao diện báo dùng commit đã đọc trước hoặc main.
Lưu/xuất project hiện nhúng cả sáu ảnh, gồm ảnh gốc đã chọn trong thư viện.

Workflow `.github/workflows/studio-library.yml` tái tạo danh mục khi asset trong
hai kho thay đổi. Nếu Actions bị tắt hoặc chặn quyền ghi, chạy thủ công
`node tools/build-studio-catalog.mjs` rồi commit/push ba file dữ liệu Studio.

Demo thử rig độc lập: mở **/cutout-demo/** trên cùng server. Có Traveler, nút
đi/chạy/đánh, hình nộm nhận hit, hiện xương và mở project/bundle từ Studio.
Có thể copy riêng `dist/cutout-demo/` sang static hosting; thư mục chứa đủ ảnh,
dữ liệu và runtime để chạy không cần client/backend Night Camp. Xem hướng dẫn
tại [dist/cutout-demo/README.md](dist/cutout-demo/README.md).

Sau khi chạy server, mở **http://localhost:7350/studio/** (hoặc `/studio/` trên
domain đã deploy). Studio chạy riêng với game và không sửa dữ liệu người chơi.

Trên điện thoại/tablet (rộng tối đa 900 px), Studio mặc định mở **Preview asset**.
Bấm **☰** góc phải để chuyển riêng từng mục: nhân vật/ảnh, điểm neo/xương,
phụ kiện, animation, frame/timeline, chỉnh tư thế hoặc project/thư viện.
Preview và nút Phát/Ghi pose luôn hiện khi chỉnh; chỉ vùng công cụ cuộn riêng.
Xoay ngang đặt preview bên trái, công cụ bên phải. Máy tính giữ bố cục ba cột.
Tab **Điểm neo & xương** có bộ chọn sáu bộ phận riêng, đồng bộ với tab nhân vật.

Phụ kiện: chọn loại **Kính** trước khi tải ảnh để gắn đúng vào mắt. Ảnh tải mới
được bỏ viền trong suốt; có thể kéo điểm neo trực tiếp tới cầu kính và xem ngay
trên nhân vật. Nút **Căn kính vào mắt** sửa cả ảnh cũ còn viền trong suốt:
đặt lại điểm gắn, neo giữa phần ảnh có nội dung và độ lệch; không thay đổi
kích thước, tỷ lệ, góc hoặc ảnh gốc. Kính mới giữ cỡ mặc định cũ (0,85 lần
bề rộng đầu). Nút **Khôi phục cỡ kính bị thu nhỏ** sửa hàng loạt kính còn
khớp cỡ mặc định 0,45 của bản lỗi trước, bỏ qua cỡ đã chỉnh hoặc đổi tỷ lệ;
có thể Hoàn tác. Với kính có trang trí lệch, chỉnh neo tới cầu kính rồi tinh chỉnh
Lệch X/Y. Project cũ không tự bị cắt ảnh hay ghi đè điểm neo đã chỉnh.

Khi nạp clip Pose Studio, Studio giữ đường cong `snap/back`, bổ sung đoạn nối
cuối chu kỳ và giữ cả các key gốc nằm ngoài thời lượng bị khai báo thiếu.
24 clip `shot`/`loop` được chuyển từ pose sống của engine gốc sang chu kỳ thở/lắc
6,8 giây gồm 205 key chỉnh được; lưu/xuất không cần hiệu ứng ẩn của game gốc.
Các clip nguồn chỉ có một pose tĩnh được ghi rõ trong danh sách, không tự tạo
thành động tác đi/chạy không có trong dữ liệu. Có thể tắt **Phát ngay sau khi nạp**.

**Thú cưng cutout:** bấm nút ở thanh công cụ hoặc mục cùng tên trong menu ☰.
**Tạo pet trống** bắt đầu với một gốc trống và một frame trung tính, không kế thừa
mẫu. Chế độ **Dựng rig** cho thêm/xóa/đổi tên xương, nối cha–con, đặt khớp trên
preview, gán ảnh, chỉnh góc gốc và lớp. Chế độ **Animation** khóa khung gốc để
kéo tạo pose không đổi cấu trúc. Đổi ID/xóa xương cập nhật các clip liên quan;
lưu bundle hoặc HTML mang theo rig mới và bộ phát tương thích.
Có 7 rig (sói, chim ưng, wyvern, đèn lồng, ba dạng rối) và 29 clip mẫu; chỉnh
xương cha/con, điểm neo, ảnh, thứ tự lớp, pose và keyframe. Project/nháp pet tách
riêng với nhân vật; có thể tạo pet mới từ rig có sẵn và tải ảnh riêng.
Xuất bundle kèm ảnh, bộ phát ES module hoặc một file HTML preview offline.
Chưa hỗ trợ mesh/Spine, biến dạng có trọng số, AI triệu hồi hay combat online.
Xem [hướng dẫn Pet Studio](dist/studio/pets/README.md) để tích hợp game khác.

- Thư viện 49 rig đầy đủ và 366 ảnh bộ phận có metadata khớp từ manifest.
- Xem trước bằng renderer cutout của game; đổi rig/ảnh đầu, thân, hai tay, hai chân.
- Thêm ảnh PNG/WebP, chỉnh kích thước và điểm neo bằng kéo thả hoặc nhập số.
- Chỉnh pose bằng góc hoặc kéo tay/chân/đầu; Shift + kéo để gập khớp.
- Tạo keyframe từ mẫu đứng/đi/chạy, nạp clip Pose Studio đã có, scrub/phát timeline,
  đổi đường cong chuyển động, ghi/xóa/đổi thời điểm keyframe, undo/redo.
- Lưu nháp trong trình duyệt, tải/mở project JSON có kèm ảnh mới và xuất game bundle.

Thay đổi pose cần bấm **Ghi pose** để cập nhật keyframe. Lưu project trước khi
xóa dữ liệu trình duyệt. Tạo rig mới bằng cách nhân bản rig có sẵn rồi thay các
ảnh; v1 giữ cấu trúc sáu bộ phận, chưa hỗ trợ sửa mesh có trọng số hay rig Spine.

Để giải nén bundle xuất từ Studio (thư mục đích phải chưa tồn tại):

```bash
node tools/install-cutout-bundle.mjs hero.game-bundle.json exported-hero
```

Kết quả gồm `cutout-export.js`, ảnh mới và bản project. Copy vào client mục tiêu;
giữ các ảnh gốc được tham chiếu. Nạp script sau `manifest.js` và
`poselib_data.js`, trước bước nạp sprite và `poselib.js`. Tạo item trỏ tới rig mới
và gắn clip `studio:<tên_clip>` vào trạng thái di chuyển mong muốn. Studio không
tự áp dụng thay đổi lên nhân vật đang chơi. Khi tích hợp game dùng bundle `cas/`,
cần cập nhật entry/bundle tương ứng, không chỉ sửa bản `js/` tham khảo.

Tái tạo danh mục Studio khi thay manifest: `node tools/build-studio-catalog.mjs`.

## Những hệ thống đã có

- Ba ô nhân vật, mật khẩu email được băm scrypt, phiên ký HMAC, refresh/logout,
  giới hạn request, kiểm tra origin, lưu file bằng ghi tạm rồi đổi tên.
- Thế giới chung theo map và ba kênh, snapshot 10 lần/giây, reconnect,
  kiểm tra quyền vào match, thứ tự lệnh và chống xử lý lệnh lặp.
- Di chuyển có giới hạn tốc độ/tầm map; đánh thường và kỹ năng có SP/cooldown,
  chí mạng, khiên, hồi máu và một số trạng thái; AI đuổi/đánh, chết và hồi sinh.
- EXP/Job EXP, tăng cấp, điểm chỉ số/kỹ năng, điều kiện đổi nghề và học kỹ năng.
- Rơi nguyên liệu/trang bị, bảo lưu quyền nhặt, túi/kho, trang bị theo bản sao,
  bán đồ, mở rộng túi, cường hóa/nâng bậc/đục ô và option.
- Chuỗi nhiệm vụ riêng bốn bước, lựa chọn lưu bền và danh vọng, điểm danh,
  nhiệm vụ ngày; phụ bản boss riêng từng nhân vật với nhận thưởng một lần.
- Thu thập có thời gian và danh mục theo map, câu cá đơn giản, vườn thảo dược,
  nấu súp/ăn, nấu và mua bình; AUTO khi còn online.
- Tổ đội, mời có hạn, chia EXP, bạn bè hai chiều, bang và quỹ bang,
  chat map, chợ chuyển quyền sở hữu đồ với phí 5%, PvP cần đồng ý hai phía.
- Bảng hệ thống tiếng Việt để thao tác các cơ chế mới trực tiếp trong game.

Danh mục trích từ client: **578 vật phẩm, 66 map, 238 loại quái, 370 nguyên liệu,
45 nghề, 465 kỹ năng**. Đây là danh mục dữ liệu; số lượng này không có nghĩa từng
script kỹ năng, sự kiện map và hành vi quái đã được tái hiện riêng hoàn toàn.

## Phạm vi cần phân biệt

Đây là một game tự host có vòng chơi độc lập, vẫn đang phát triển. Công thức,
bốn nhiệm vụ, thu thập, kinh tế và encounter phụ bản là thiết kế của backend này.
Nhiều kỹ năng hiện dùng bộ xử lý chung; chưa có toàn bộ tương tác riêng của 465
kỹ năng, kịch bản boss/phụ bản gốc, cây hội thoại gốc, chiến trường bang theo mùa,
thanh toán/nạp tiền, mô phỏng AUTO offline, kiểm tra va chạm đầy đủ theo layout
client và cơ sở dữ liệu nhiều tiến trình. Không gọi đây là bản tương đương 100%
server Night Camp chính thức. Chi tiết: [docs/backend-status.md](docs/backend-status.md).

## Kiểm tra và công cụ

```bash
cd server
npm test
```

Kiểm tra bao gồm giao dịch rollback, chống thưởng lặp, tổ đội/kênh/PvP, thời gian
farm/thu thập, hai WebSocket thực, xác thực và khôi phục sau restart.

- `dist/`: client boot/runtime đã chỉnh cho server clone.
- `dist-full/`: kho client/asset đầy đủ đã tải, gồm 62 bản nhạc; server dùng làm
  nguồn bổ sung khi asset không có trong `dist/`.
- `tools/build-server-catalog.mjs`: trích danh mục public bằng sandbox build;
  hook trình duyệt không chạy được được ghi trong provenance. Server chỉ đọc JSON.
- `tools/recover-music.mjs`: tải nhạc được tham chiếu bởi manifest đã lưu.
- `docs/game-systems-catalog.md`, `docs/online-feature-ledger.md`: nghiên cứu hợp
  đồng client cũ; tình trạng triển khai hiện tại xem `backend-status.md`.
