# Agent Office — Văn phòng AI

Văn phòng 3D để làm việc với các agent Claude Code. Mỗi agent có vai trò,
phòng làm việc và terminal riêng; bạn có thể theo dõi hoạt động ngay trong văn phòng.

**Bạn không cần tự tạo shortcut hay tự cài Node.js.** Sau khi tải mã nguồn,
chạy file khởi động một lần. Chương trình tự chuẩn bị ứng dụng và tạo shortcut
**Agent Office**. Những lần sau chỉ cần bấm shortcut đó.

## Chuẩn bị trước khi chạy

- Máy Windows hoặc Ubuntu, kiến trúc x64 hoặc ARM64.
- Kết nối Internet cho lần chạy đầu để tải môi trường và các thư viện cần thiết.
- Windows: có PowerShell; nên có Microsoft Edge hoặc Google Chrome.
- Ubuntu: có Python 3; nên có Google Chrome hoặc Chromium.
- Muốn agent thực hiện công việc: cài Claude Code và đăng nhập tài khoản riêng
  theo phần [Kết nối Claude Code](#kết-nối-claude-code).

Launcher tự tải Node.js nếu máy chưa có phiên bản phù hợp, không cần quyền
Administrator hoặc `sudo`. Trên Ubuntu, nếu máy thiếu Python 3 thì việc cài
Python qua trình quản lý gói có thể cần `sudo`.

Windows và Ubuntu có file khởi động khác nhau; các bước cài môi trường được tự động hóa.
Launcher Ubuntu đã được kiểm thử. Launcher Windows chưa được kiểm thử trực tiếp
trên máy Windows. Hiện chưa có launcher cho macOS.

## Cài và mở trên Windows

### Bước 1: Tải ứng dụng

Chọn một trong hai cách:

**Cách A — tải ZIP, không cần Git:**

1. Mở [repo Agent Office](https://github.com/Searn-1007/Agent-office).
2. Bấm **Code → Download ZIP**.
3. Giải nén vào một thư mục bạn muốn giữ lâu dài, ví dụ `C:\Apps\Agent-office`.
4. Mở thư mục đã giải nén, nơi có các file `launch.cmd`, `launch.ps1` và `package.json`.

**Cách B — dùng Git nếu máy đã có Git:**

Mở PowerShell hoặc Terminal ở thư mục muốn lưu ứng dụng, rồi chạy:

```powershell
git clone https://github.com/Searn-1007/Agent-office.git
cd Agent-office
```

### Bước 2: Chạy lần đầu

1. Bấm đúp file **`launch.cmd`** trong thư mục ứng dụng.
2. Một cửa sổ dòng lệnh hiện ra để chuẩn bị ứng dụng. Giữ cửa sổ này mở và đợi hoàn tất.
3. Chương trình tự tải Node.js nếu cần, cài thư viện và build giao diện.
4. Văn phòng mở trong một cửa sổ app riêng nếu tìm thấy Edge hoặc Chrome;
   nếu không, chương trình mở bằng trình duyệt mặc định.
5. Sau khi mở thành công, chương trình tự tạo shortcut **Agent Office** ở
   **Desktop** và **Start Menu**.

Bạn không cần chạy riêng `npm install`, `npm run build` hoặc tự tạo shortcut.
Nếu có lỗi, cửa sổ dòng lệnh sẽ giữ lại thông báo để bạn đọc.

### Bước 3: Những lần dùng tiếp theo

Bấm đúp **Agent Office** trên Desktop, hoặc tìm **Agent Office** trong Start Menu.
Không cần mở thư mục mã nguồn hay gõ lệnh mỗi lần dùng.

Windows hiện kiểm tra thư viện và build giao diện mỗi lần mở, nên có thể cần
đợi một lúc trước khi cửa sổ app xuất hiện.

## Cài và mở trên Ubuntu

### Bước 1: Tải ứng dụng

Nếu máy đã có Git, mở Terminal tại thư mục muốn lưu ứng dụng và chạy:

```bash
git clone https://github.com/Searn-1007/Agent-office.git
cd Agent-office
```

Hoặc tải **Code → Download ZIP** từ [repo](https://github.com/Searn-1007/Agent-office),
giải nén, rồi mở Terminal trong thư mục chứa `launch.sh`.
Có thể bấm chuột phải trong thư mục và chọn **Open in Terminal**.

### Bước 2: Chạy lần đầu

Trong Terminal đang ở thư mục ứng dụng, chạy:

```bash
bash launch.sh
```

Chương trình sẽ:

1. Tìm Node.js phù hợp hoặc tự tải một bản riêng cho Agent Office.
2. Cài thư viện và build giao diện.
3. Tự tạo shortcut **Agent Office** trong menu ứng dụng và trên Desktop
   nếu máy có thư mục Desktop được cấu hình.
4. Khởi động server và mở cửa sổ văn phòng.

Chờ đến khi văn phòng xuất hiện. Lần đầu cần tải dữ liệu nên có thể mất lâu hơn.
Nếu đã clone bằng Git, bạn cũng có thể chạy `./launch.sh` trực tiếp.

### Bước 3: Những lần dùng tiếp theo

- Bấm phím **Super** (phím Windows), tìm **Agent Office** rồi mở; hoặc
- Bấm đúp shortcut **Agent Office** trên Desktop.

Nếu Ubuntu chưa cho phép mở shortcut Desktop, bấm chuột phải vào biểu tượng và
chọn **Allow Launching / Cho phép khởi chạy**. Shortcut đã được chương trình tạo;
bước này chỉ cho phép desktop sử dụng nó.

Ubuntu dùng lại thư viện và bản build khi chưa có thay đổi. Nếu thiếu Chrome hoặc
Chromium, ứng dụng sẽ mở bằng trình duyệt mặc định. Shortcut có thể mở thêm
Terminal để hiển thị tiến trình hoặc lỗi.

## Kết nối Claude Code

**Mở được văn phòng và chạy được agent là hai bước riêng.** Giao diện có thể mở
khi chưa cài Claude Code, nhưng muốn agent làm việc thì máy cần Claude Code đã đăng nhập.

1. Cài Claude Code theo [hướng dẫn chính thức](https://code.claude.com/docs/en/setup).
2. Mở một Terminal hoặc PowerShell mới sau khi cài.
3. Chạy:

   ```text
   claude
   ```

4. Hoàn tất đăng nhập theo hướng dẫn của Claude Code bằng tài khoản của bạn.
5. Kiểm tra trạng thái:

   ```text
   claude auth status
   ```

6. Nếu Agent Office đang chạy từ trước khi cài Claude Code, dừng server theo
   phần bên dưới, rồi mở lại bằng shortcut để nhận môi trường mới.

Launcher không tự cài Claude Code hoặc đăng nhập thay bạn. Mỗi người dùng tài
khoản và quyền truy cập Claude của riêng mình.

## Bắt đầu làm việc trong văn phòng

1. Chọn một mẫu văn phòng, chỉnh tên và các phòng nếu muốn.
2. Bấm **Vào văn phòng →**.
3. Bấm **+ Thêm agent**.
4. Chọn vai trò/phòng, đặt tên và chọn thư mục dự án mà agent sẽ làm việc.
   Bạn có thể dán đường dẫn khác rồi bấm **Lưu thư mục**.
5. Bấm **Tuyển agent** để khởi động Claude Code.
6. Mở terminal của agent và nhập yêu cầu. Nếu Claude Code hỏi xác nhận thư mục
   hoặc quyền thao tác, xem nội dung rồi trả lời trong terminal đó.

## Shortcut, thư mục cài đặt và việc đóng app

- **Shortcut được tạo tự động khi chạy launcher lần đầu thành công.** Chỉ clone
  hoặc giải nén repo chưa tạo shortcut, vì chưa có chương trình nào được chạy.
- Giữ nguyên thư mục ứng dụng sau khi cài. Shortcut trỏ tới thư mục này, vì vậy
  không xóa hoặc di chuyển nó nếu còn muốn dùng shortcut.
- Nếu đã di chuyển thư mục, chạy lại `launch.cmd` hoặc `bash launch.sh` tại vị trí
  mới để cập nhật shortcut. Dừng server cũ trước khi chuyển sang bản ở vị trí mới.
- Đóng cửa sổ văn phòng chỉ đóng giao diện. Server nền và các agent đang chạy
  có thể tiếp tục hoạt động. Mở lại shortcut để vào lại văn phòng đang chạy.
- Tắt server sẽ đóng toàn bộ agent do server đó khởi động. Khi khởi động lại
  server, các tiến trình agent cũ không được tự khôi phục.

### Dừng server trên Ubuntu

Chỉ chạy lệnh này khi muốn dừng văn phòng và các agent của nó:

```bash
kill -TERM "$(cat ~/.agent-office/server.pid)"
```

### Dừng server trên Windows

Mở **Task Manager → Details**, bật cột **Command line** và tìm tiến trình
`node.exe` có dòng lệnh chứa đường dẫn tới `Agent-office\server\index.mjs`
trong thư mục đã cài. Chọn đúng tiến trình đó và bấm **End task**.

## Cập nhật ứng dụng

Nếu cài bằng Git, dừng server khi đã hoàn tất công việc của các agent, mở Terminal
hoặc PowerShell trong thư mục ứng dụng và chạy:

```text
git pull
```

Sau đó mở lại shortcut hoặc chạy lại launcher. Nó tự cập nhật thư viện và build
khi cần; bạn không cần tự chạy các lệnh npm.

Nếu tải ZIP, dừng server, tải bản ZIP mới và giải nén vào thư mục mới. Chạy
launcher trong thư mục mới để cập nhật shortcut. Cấu hình cá nhân vẫn nằm ngoài
repo nên không bị thay thế khi đổi thư mục mã nguồn.

## Xử lý lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Chưa thấy shortcut sau khi tải repo | Chạy `launch.cmd` trên Windows hoặc `bash launch.sh` trên Ubuntu một lần và đợi hoàn tất. |
| Cài thư viện hoặc tải Node.js thất bại | Kiểm tra kết nối Internet, đọc lỗi trong cửa sổ dòng lệnh rồi chạy lại launcher. |
| Ubuntu báo thiếu `python3` | Cài bằng `sudo apt install python3`, rồi chạy lại `bash launch.sh`. |
| Ubuntu báo `Permission denied` khi chạy `./launch.sh` | Dùng `bash launch.sh`, hoặc chạy `chmod +x launch.sh` rồi thử lại. |
| Shortcut Desktop Ubuntu chưa mở được | Chuột phải → **Allow Launching**; hoặc mở từ menu ứng dụng. |
| Giao diện mở trong tab trình duyệt | Launcher chưa tìm thấy trình duyệt hỗ trợ cửa sổ app; dùng Chrome/Chromium trên Ubuntu hoặc Edge/Chrome trên Windows. |
| Báo chưa tìm thấy Claude Code | Cài Claude Code, kiểm tra `claude auth status`, dừng server cũ rồi mở lại Agent Office. |
| Báo cổng `3300` bị ứng dụng khác sử dụng | Dừng ứng dụng đang chiếm cổng rồi chạy lại launcher. |
| Giao diện báo “Mất kết nối…” | Mở lại bằng shortcut để dùng đúng URL có token và khởi động server nếu cần; kiểm tra log nếu vẫn lỗi. |
| Shortcut không chạy sau khi di chuyển thư mục | Chạy lại launcher từ vị trí mới để tạo lại shortcut. |

### Xem log và cấu hình

| Dữ liệu | Ubuntu | Windows |
| --- | --- | --- |
| Thư mục cấu hình, token và runtime riêng | `~/.agent-office/` | `%USERPROFILE%\.agent-office\` |
| Log server | `~/.agent-office/server.log` | `%USERPROFILE%\.agent-office\server.log` |
| Log lỗi server riêng | Chung trong `server.log` | `%USERPROFILE%\.agent-office\server-error.log` |
| Log cửa sổ app | `~/.agent-office/app.log` | Không có log app riêng |
| URL mở văn phòng có token | `~/.agent-office/url.txt` | `%USERPROFILE%\.agent-office\url.txt` |

Trên Windows có thể dán `%USERPROFILE%\.agent-office` vào thanh địa chỉ File Explorer
để mở thư mục dữ liệu. Trên Ubuntu, `~` là thư mục home của người dùng.

Cấu hình và token ở ngoài repo. Không đưa thư mục này lên GitHub hoặc chia sẻ
URL chứa token. Khi dùng bình thường, cứ mở bằng shortcut để lấy đúng URL.

## Dành cho người phát triển

Phần này dành cho việc sửa mã nguồn; người dùng bình thường chỉ cần launcher.
Nếu chạy thủ công, cần Node.js 22.12+ và npm trong PATH.

```bash
npm ci
npm run build   # kiểm tra TypeScript + build giao diện vào web/dist
npm test        # kiểm tra server
npm start       # chạy server và phục vụ bản build
```

`npm run dev` mở Vite để phát triển giao diện; không tự chạy các agent.
Trên Windows PowerShell, dùng `npm.cmd` nếu chính sách chặn `npm.ps1`.

Các tùy chọn launcher Ubuntu:

```bash
bash launch.sh --setup-only  # chỉ chuẩn bị môi trường, build và shortcut
bash launch.sh --no-open     # khởi động server, không mở cửa sổ app
```

Mã giao diện thay đổi cần build lại. Mã server thay đổi cần dừng server rồi mở
lại; việc này cũng đóng các agent đang chạy.

### Cấu trúc chính

- `launch.cmd`, `launch.ps1`: chuẩn bị môi trường và mở app trên Windows.
- `launch.sh`, `scripts/launch.py`: chuẩn bị môi trường và mở app trên Ubuntu/Linux.
- `server/agents.mjs`: chạy mỗi Claude Code agent trong một PTY riêng và nhận diện
  các màn hình chờ xác nhận bằng terminal headless.
- `server/transcript.mjs`: theo dõi transcript Claude để cập nhật hoạt động,
  kết thúc lượt và sub-agent.
- `server/roles.mjs`: lời nhắc theo vai trò và ánh xạ sub-agent vào phòng.
- `web/src/building.ts`: bố cục và hình học tòa nhà.
- `web/src/office.ts`: camera, đường đi và nhân vật.
- `web/src/ui.ts`, `web/src/terminal.ts`: giao diện điều khiển và terminal.
