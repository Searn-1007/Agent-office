/**
 * Office setups: which rooms exist today, who works in them and what each
 * agent is told. The user picks a template when the app opens and can edit
 * every room before walking in.
 */

export type Theme =
  | 'lead'
  | 'code'
  | 'test'
  | 'review'
  | 'robot'
  | 'sim'
  | 'hardware'
  | 'pcb'
  | 'firmware'
  | 'report'
  | 'video'
  | 'audio'
  | 'design'
  | 'research'
  | 'writing'
  | 'files'
  | 'system';

export interface RoomRole {
  /** Short id agents use to hand work to this room ("dev: …"). */
  id: string;
  /** Room name shown on the sign. */
  name: string;
  /** Role label on name tags. */
  label: string;
  color: string;
  theme: Theme;
  /** Coordinates the others: told to delegate to sub-agents by room id. */
  coordinator: boolean;
  /** What agents in this room are told on launch (appended to Claude Code's prompt). */
  prompt: string;
}

export interface Setup {
  name: string;
  rooms: RoomRole[];
}

export const MAX_ROOMS = 5;

export const PALETTE = ['#e5383b', '#3a86ff', '#2ec27e', '#9b5de5', '#f4a261', '#00b4d8', '#ff70a6', '#8d99ae'];

export const THEMES: Array<{ id: Theme; label: string }> = [
  { id: 'lead', label: 'Điều phối' },
  { id: 'code', label: 'Lập trình' },
  { id: 'test', label: 'Kiểm thử' },
  { id: 'review', label: 'Soát lỗi' },
  { id: 'robot', label: 'Robot / ROS' },
  { id: 'sim', label: 'Mô phỏng' },
  { id: 'hardware', label: 'Phần cứng' },
  { id: 'pcb', label: 'Thiết kế mạch' },
  { id: 'firmware', label: 'Firmware' },
  { id: 'report', label: 'Báo cáo' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Âm thanh' },
  { id: 'design', label: 'Đồ hoạ' },
  { id: 'research', label: 'Nghiên cứu' },
  { id: 'writing', label: 'Viết lách' },
  { id: 'files', label: 'File & dữ liệu' },
  { id: 'system', label: 'Máy tính' },
];

const r = (
  id: string,
  name: string,
  label: string,
  color: string,
  theme: Theme,
  prompt: string,
  coordinator = false,
): RoomRole => ({ id, name, label, color, theme, prompt, coordinator });

export const TEMPLATES: Array<Setup & { key: string; desc: string }> = [
  {
    key: 'code',
    name: 'Lập trình',
    desc: 'Dự án phần mềm: chia việc, viết code, test, soát lỗi',
    rooms: [
      r('lead', 'Phòng Lead', 'Lead', PALETTE[0], 'lead', 'Bạn là trưởng nhóm phần mềm. Lên kế hoạch và giao từng việc nhỏ cho các phòng thay vì tự làm hết.', true),
      r('dev', 'Phòng Dev', 'Dev', PALETTE[1], 'code', 'Bạn là lập trình viên. Sửa code cẩn thận theo đúng phong cách sẵn có, và build hoặc chạy thử để chắc chắn nó chạy.'),
      r('test', 'Phòng Test', 'Test', PALETTE[2], 'test', 'Bạn là người kiểm thử. Viết và chạy test, tái hiện lỗi và báo chính xác chỗ hỏng. Không sửa code chính nếu chưa được yêu cầu.'),
      r('review', 'Phòng Review', 'Review', PALETTE[3], 'review', 'Bạn là người soát code. Tìm lỗi, rủi ro và chỗ có thể làm gọn, ghi rõ file và dòng. Không sửa file nếu chưa được yêu cầu.'),
    ],
  },
  {
    key: 'ros',
    name: 'ROS 2 & Robot',
    desc: 'Node, launch, mô phỏng Gazebo/RViz, phần cứng robot',
    rooms: [
      r('lead', 'Phòng Lead', 'Lead', PALETTE[0], 'lead', 'Bạn là trưởng nhóm robot ROS 2. Chia mục tiêu thành việc viết node, mô phỏng, phần cứng và kiểm thử rồi giao cho từng phòng.', true),
      r('ros', 'Phòng ROS', 'ROS Dev', PALETTE[1], 'robot', 'Bạn viết code ROS 2: node Python/C++, launch file, URDF/xacro, tham số. Build bằng colcon và source workspace trước khi chạy. ROS 2 có thể nằm trong WSL hoặc trên máy Ubuntu riêng, hãy kiểm tra trước khi giả định.'),
      r('sim', 'Phòng Mô phỏng', 'Mô phỏng', PALETTE[5], 'sim', 'Bạn chạy và gỡ lỗi mô phỏng (Gazebo, RViz, MATLAB/Simulink). Khởi động sim, theo dõi topic và TF, báo robot thực tế làm gì so với mong muốn.'),
      r('hw', 'Phòng Phần cứng', 'Phần cứng', PALETTE[4], 'hardware', 'Bạn lo phần cứng robot: micro-ROS, thiết bị serial/USB, driver động cơ, cảm biến và hiệu chuẩn. Không bao giờ gửi lệnh chuyển động tới phần cứng thật khi người dùng chưa xác nhận an toàn.'),
      r('test', 'Phòng Test', 'Test', PALETTE[2], 'test', 'Bạn kiểm thử phần mềm robot: viết launch test và unit test, phát lại rosbag, báo lỗi kèm lệnh chính xác để tái hiện.'),
    ],
  },
  {
    key: 'hw',
    name: 'Mạch & Vi xử lý',
    desc: 'Firmware STM32/Arduino, vẽ mạch KiCad, báo cáo bài tập lớn',
    rooms: [
      r('lead', 'Phòng Lead', 'Lead', PALETTE[0], 'lead', 'Bạn điều phối dự án nhúng: firmware, sơ đồ mạch/PCB và báo cáo. Chia việc và giao cho từng phòng.', true),
      r('fw', 'Phòng Firmware', 'Firmware', PALETTE[1], 'firmware', 'Bạn viết firmware vi điều khiển (STM32 với STM32CubeIDE/HAL, Arduino, AVR). Chú ý sơ đồ chân, xung clock và ngoại vi; build thành công rồi mới báo là chạy.'),
      r('pcb', 'Phòng Mạch', 'KiCad', PALETTE[2], 'pcb', 'Bạn thiết kế mạch bằng KiCad. Sửa sơ đồ và PCB cẩn thận (file KiCad là dạng text), chạy ERC/DRC và xuất file bằng kicad-cli, giữ danh sách linh kiện (BOM). Giải thích mọi lựa chọn về điện.'),
      r('report', 'Phòng Báo cáo', 'Báo cáo', PALETTE[3], 'report', 'Bạn viết báo cáo bài tập lớn bằng tiếng Việt: bố cục, hình vẽ, bảng biểu và giải thích đúng chuẩn giảng viên yêu cầu. Thiếu số liệu đo thì hỏi, không tự bịa.'),
      r('check', 'Phòng Kiểm tra', 'Kiểm tra', PALETTE[4], 'review', 'Bạn kiểm tra thiết kế: đối chiếu firmware và sơ đồ mạch với datasheet, tìm lỗi nối dây và lỗi logic, liệt kê kèm mức độ nghiêm trọng.'),
    ],
  },
  {
    key: 'video',
    name: 'Dựng video',
    desc: 'Cắt ghép, phụ đề, âm thanh, đồ hoạ',
    rooms: [
      r('director', 'Phòng Đạo diễn', 'Đạo diễn', PALETTE[0], 'lead', 'Bạn là đạo diễn video. Biến yêu cầu thành danh sách cảnh và kế hoạch dựng, rồi giao việc biên tập, âm thanh/phụ đề và đồ hoạ.', true),
      r('edit', 'Phòng Biên tập', 'Biên tập', PALETTE[1], 'video', 'Bạn dựng video bằng ffmpeg và script: cắt, ghép, chuyển cảnh, xuất file. Không bao giờ ghi đè video gốc, luôn tạo file mới.'),
      r('audio', 'Phòng Âm thanh', 'Âm thanh', PALETTE[6], 'audio', 'Bạn lo âm thanh và phụ đề: cân bằng âm lượng, lọc ồn, ghép nhạc, tạo hoặc dịch phụ đề SRT.'),
      r('gfx', 'Phòng Đồ hoạ', 'Đồ hoạ', PALETTE[3], 'design', 'Bạn làm đồ hoạ: thumbnail, khung tiêu đề, lớp phủ và chuyển động đơn giản bằng các công cụ có trên máy.'),
    ],
  },
  {
    key: 'daily',
    name: 'Việc hằng ngày',
    desc: 'Tra cứu, viết lách, sắp xếp file, cài đặt máy tính',
    rooms: [
      r('assistant', 'Phòng Trợ lý', 'Trợ lý', PALETTE[0], 'lead', 'Bạn là trợ lý chính cho việc hằng ngày. Hiểu người dùng cần gì rồi giao việc tra cứu, viết lách, xử lý file hoặc cài đặt máy.', true),
      r('research', 'Phòng Nghiên cứu', 'Nghiên cứu', PALETTE[5], 'research', 'Bạn tra cứu trên mạng và tóm tắt kèm nguồn. Nói rõ điều gì chưa kiểm chứng được.'),
      r('write', 'Phòng Viết', 'Viết lách', PALETTE[3], 'writing', 'Bạn viết và sửa văn bản: email, tài liệu, bài luận, bài thuyết trình, đúng giọng văn người dùng muốn.'),
      r('files', 'Phòng Dữ liệu', 'File & dữ liệu', PALETTE[4], 'files', 'Bạn sắp xếp file và dữ liệu: đổi tên, phân loại, chuyển định dạng, làm sạch bảng tính. Trình bày kế hoạch trước khi di chuyển hay xoá bất cứ thứ gì.'),
      r('pc', 'Phòng Máy tính', 'Máy tính', PALETTE[1], 'system', 'Bạn giúp việc trên máy Windows: cài đặt, tinh chỉnh, viết script và sửa lỗi. Giải thích bước nào rủi ro và hỏi trước khi đổi cài đặt hệ thống.'),
    ],
  },
  {
    key: 'blank',
    name: 'Tuỳ chỉnh',
    desc: 'Bắt đầu từ một phòng trống và tự thêm',
    rooms: [r('main', 'Phòng chính', 'Agent', PALETTE[1], 'code', 'Bạn là một agent trợ giúp. Làm cẩn thận đúng việc người dùng nhờ và giải thích những gì đã làm.')],
  },
];

export function cloneSetup(s: Setup): Setup {
  return { name: s.name, rooms: s.rooms.map((x) => ({ ...x })) };
}

/** Lower-case, ascii-ish id from a label, unique among `taken`. */
export function makeRoomId(label: string, taken: string[]): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 10) || 'room';
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}${i}`;
  return id;
}
