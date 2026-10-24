/** The HTML chrome around the 3D office: the setup screen, navigation, stats,
 *  roster, activity feed, the "add agent" dialog and the terminal drawer. */

import type { ViewId } from './office';
import type { RoomRole, Setup, Theme } from './setup';
import { cloneSetup, makeRoomId, MAX_ROOMS, PALETTE, TEMPLATES, THEMES } from './setup';
import type { AgentInfo, DirInfo, SubagentInfo } from './types';
import { STATUS_META, UNKNOWN_ROOM_COLOR } from './types';

export interface UiHandlers {
  onView: (view: ViewId) => void;
  onSetup: (setup: Setup) => void;
  onDeleteSetup: (name: string) => void;
  onCreate: (name: string, roomId: string, cwd: string) => void;
  onAddDir: (path: string) => void;
  onOpenAgent: (id: number) => void;
  onCloseAgent: (id: number) => void;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

const TABS: Array<{ view: ViewId; label: string }> = [
  { view: 'overview', label: 'Toàn cảnh' },
  { view: 'level0', label: 'Tầng 1' },
  { view: 'level1', label: 'Tầng 2' },
  { view: 'yard', label: 'Sân vườn' },
];

export class Ui {
  readonly termHost: HTMLDivElement;
  private agents: AgentInfo[] = [];
  private dirs: DirInfo[] = [];
  private setup: Setup | null = null;
  private saved: Setup[] = [];
  private openId: number | null = null;
  private view: ViewId = 'overview';
  private readonly nav: HTMLElement;
  private readonly eyebrow: HTMLDivElement;
  private readonly tabButtons = new Map<ViewId, HTMLButtonElement>();
  private readonly stats: HTMLDivElement;
  private readonly statsBody: HTMLDivElement;
  private readonly fpsEl: HTMLElement;
  private readonly roster: HTMLDivElement;
  private readonly rosterList: HTMLDivElement;
  private readonly feed: HTMLDivElement;
  private readonly feedList: HTMLDivElement;
  private readonly drawer: HTMLDivElement;
  private readonly drawerHead: HTMLDivElement;
  private readonly drawerTabs: HTMLDivElement;
  private readonly conn: HTMLSpanElement;
  private readonly toasts: HTMLDivElement;
  private readonly modal: HTMLDivElement;
  private readonly roomCards: HTMLDivElement;
  private readonly setupScreen: HTMLDivElement;
  private draft: Setup = cloneSetup(TEMPLATES[0]);
  private dirSelect!: HTMLSelectElement;
  private chosenRoom = '';
  private lastStatus = new Map<number, string>();

  constructor(
    root: HTMLElement,
    private readonly handlers: UiHandlers,
  ) {
    this.nav = h('nav', { class: 'nav' });
    this.eyebrow = h('div', { class: 'eyebrow' }, 'VĂN PHÒNG · CLAUDE CODE');
    const addBtn = h('button', { class: 'btn-primary' }, '+ Thêm agent');
    addBtn.addEventListener('click', () => this.openModal());
    const left = h(
      'aside',
      { class: 'panel left' },
      h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, 'AI'), h('span', {}, 'AGENT OFFICE')),
      this.eyebrow,
      h('h1', {}, 'Văn phòng AI', h('br'), 'của bạn.'),
      h('p', { class: 'lead-text' }, 'Mỗi nhân viên là một agent Claude Code thật, ngồi đúng phòng việc của mình.'),
      this.nav,
      addBtn,
    );

    this.conn = h('span', { class: 'conn' }, 'Đang kết nối…');
    const setupBtn = h('button', { class: 'chip' }, 'Thiết lập');
    const rosterBtn = h('button', { class: 'chip' }, 'Nhân sự');
    const feedBtn = h('button', { class: 'chip' }, 'Hoạt động');
    setupBtn.addEventListener('click', () => this.openSetup());
    rosterBtn.addEventListener('click', () => this.toggle(this.roster, this.feed));
    feedBtn.addEventListener('click', () => this.toggle(this.feed, this.roster));
    const top = h('div', { class: 'topbar' }, this.conn, setupBtn, rosterBtn, feedBtn);

    const tabs = h('div', { class: 'tabs' });
    for (const t of TABS) {
      const b = h('button', { class: 'tab' }, t.label);
      b.addEventListener('click', () => this.selectView(t.view));
      this.tabButtons.set(t.view, b);
      tabs.append(b);
    }

    this.statsBody = h('div', { class: 'stats-body' });
    this.fpsEl = h('b', {}, '–');
    this.stats = h(
      'div',
      { class: 'panel stats' },
      this.statsBody,
      h('div', { class: 'stat-row' }, h('span', {}, 'Khung hình / giây'), this.fpsEl),
    );

    this.rosterList = h('div', { class: 'list' });
    this.roster = h('div', { class: 'panel side hidden' }, h('h3', {}, 'Nhân sự'), this.rosterList);
    this.feedList = h('div', { class: 'list feed-list' });
    this.feed = h('div', { class: 'panel side hidden' }, h('h3', {}, 'Hoạt động'), this.feedList);

    this.drawerHead = h('div', { class: 'drawer-head' });
    this.drawerTabs = h('div', { class: 'drawer-tabs' });
    this.termHost = h('div', { class: 'term-host' });
    this.drawer = h('div', { class: 'drawer hidden' }, this.drawerHead, this.drawerTabs, this.termHost);

    this.toasts = h('div', { class: 'toasts' });
    this.roomCards = h('div', { class: 'role-grid' });
    this.modal = this.buildModal();
    this.setupScreen = h('div', { class: 'setup hidden' });

    root.append(left, top, tabs, this.stats, this.roster, this.feed, this.drawer, this.toasts, this.modal, this.setupScreen);
    this.render();
  }

  // ── State in ────────────────────────────────────────────────────────────

  setConnected(ok: boolean): void {
    this.conn.textContent = ok ? 'Đã kết nối' : 'Mất kết nối…';
    this.conn.classList.toggle('ok', ok);
  }

  setFps(fps: number): void {
    this.fpsEl.textContent = fps > 0 ? String(fps) : '–';
  }

  setSetup(setup: Setup | null, saved: Setup[]): void {
    this.setup = setup;
    this.saved = saved;
    this.eyebrow.textContent = setup ? `HÔM NAY · ${setup.name.toUpperCase()}` : 'CHƯA THIẾT LẬP';
    this.renderNav();
    this.render();
    if (!this.setupScreen.classList.contains('hidden')) this.renderSetup();
  }

  setAgents(agents: AgentInfo[]): void {
    for (const a of agents) {
      const prev = this.lastStatus.get(a.id);
      if (prev !== a.status) {
        if (prev !== undefined || a.status !== 'starting') this.log(a);
        if (a.status === 'approval') {
          this.toast(`${a.name} cần bạn duyệt — bấm để mở`, () => this.handlers.onOpenAgent(a.id));
        }
        this.lastStatus.set(a.id, a.status);
      }
    }
    for (const id of [...this.lastStatus.keys()]) {
      if (!agents.some((a) => a.id === id)) this.lastStatus.delete(id);
    }
    this.agents = agents;
    if (this.openId !== null && !agents.some((a) => a.id === this.openId)) this.closeDrawer();
    this.render();
  }

  setDirs(dirs: DirInfo[]): void {
    this.dirs = dirs;
    this.fillDirs();
  }

  error(message: string): void {
    this.toast(message);
  }

  private roomOf(roomId: string): RoomRole | undefined {
    return this.setup?.rooms.find((r) => r.id === roomId);
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  private renderNav(): void {
    const items: Array<{ view: ViewId; label: string; hint?: string; color?: string }> = [
      { view: 'overview', label: 'Toàn cảnh' },
      { view: 'level0', label: 'Tầng 1' },
      { view: 'level1', label: 'Tầng 2' },
      ...(this.setup?.rooms ?? []).map((r) => ({ view: `room:${r.id}` as ViewId, label: r.name, hint: r.label, color: r.color })),
      { view: 'room:pantry', label: 'Pantry', hint: 'Nghỉ giải lao' },
    ];
    this.nav.replaceChildren(
      ...items.map((item) => {
        const dot = h('span', { class: 'nav-dot' });
        if (item.color) dot.style.background = item.color;
        const b = h('button', { class: `nav-item${item.view === this.view ? ' active' : ''}` }, dot, h('span', {}, item.label));
        if (item.hint) b.append(h('small', {}, item.hint));
        b.addEventListener('click', () => this.selectView(item.view));
        return b;
      }),
    );
  }

  private render(): void {
    const working = this.agents.filter((a) => a.status === 'working').length;
    const approval = this.agents.filter((a) => a.status === 'approval').length;
    const subs = this.agents.reduce((n, a) => n + a.subagents.length, 0);
    this.statsBody.replaceChildren(
      h('div', { class: 'eyebrow' }, 'THÔNG SỐ VĂN PHÒNG'),
      ...[
        ['Nhân viên', String(this.agents.length)],
        ['Đang làm việc', String(working)],
        ['Chờ bạn duyệt', String(approval)],
        ['Sub-agent đang chạy', String(subs)],
        ['Phòng', `${this.setup?.rooms.length ?? 0} + Pantry`],
      ].map(([k, v]) => h('div', { class: 'stat-row' }, h('span', {}, k), h('b', {}, v))),
    );

    this.rosterList.replaceChildren(
      ...(this.agents.length
        ? this.agents.flatMap((a) => [this.agentRow(a), ...a.subagents.map((sub) => this.subagentRow(a, sub))])
        : [h('p', { class: 'muted' }, 'Chưa có ai. Bấm "+ Thêm agent" để tuyển nhân viên đầu tiên.')]),
    );

    this.drawerTabs.replaceChildren(
      ...this.agents.map((a) => {
        const b = h('button', { class: `dtab${a.id === this.openId ? ' active' : ''}` }, a.name);
        b.style.setProperty('--role', this.roomOf(a.roomId)?.color ?? UNKNOWN_ROOM_COLOR);
        b.addEventListener('click', () => this.handlers.onOpenAgent(a.id));
        return b;
      }),
    );
    this.renderDrawerHead();
  }

  private roleChip(roomId: string): HTMLElement {
    const room = this.roomOf(roomId);
    const chip = h('span', { class: 'role-chip' }, room?.label ?? '?');
    chip.style.setProperty('--role', room?.color ?? UNKNOWN_ROOM_COLOR);
    return chip;
  }

  private agentRow(a: AgentInfo): HTMLElement {
    const st = STATUS_META[a.status];
    const row = h(
      'button',
      { class: 'agent-row' },
      this.roleChip(a.roomId),
      h('span', { class: 'agent-main' }, h('b', {}, a.name), h('small', {}, a.activity || st.label)),
      h('span', { class: 'status-dot', title: st.label }),
    );
    row.style.setProperty('--role', this.roomOf(a.roomId)?.color ?? UNKNOWN_ROOM_COLOR);
    row.style.setProperty('--status', st.css);
    row.addEventListener('click', () => this.handlers.onOpenAgent(a.id));
    return row;
  }

  // Sub-agents have no terminal of their own; clicking opens the parent's.
  private subagentRow(parent: AgentInfo, sub: SubagentInfo): HTMLElement {
    const row = h(
      'button',
      { class: 'agent-row sub' },
      this.roleChip(sub.roomId),
      h('span', { class: 'agent-main' }, h('b', {}, sub.label), h('small', {}, `Sub-agent của ${parent.name}`)),
      h('span', { class: 'status-dot', title: 'Đang làm việc' }),
    );
    row.style.setProperty('--role', this.roomOf(sub.roomId)?.color ?? UNKNOWN_ROOM_COLOR);
    row.style.setProperty('--status', STATUS_META.working.css);
    row.addEventListener('click', () => this.handlers.onOpenAgent(parent.id));
    return row;
  }

  private renderDrawerHead(): void {
    const a = this.agents.find((x) => x.id === this.openId);
    if (!a) {
      this.drawerHead.replaceChildren();
      return;
    }
    const st = STATUS_META[a.status];
    const close = h('button', { class: 'icon-btn', title: 'Đóng khung terminal' }, '×');
    close.addEventListener('click', () => this.closeDrawer());
    const kill = h('button', { class: 'chip danger' }, a.exited ? 'Xoá khỏi văn phòng' : 'Cho nghỉ việc');
    kill.addEventListener('click', () => {
      if (a.exited || confirm(`Tắt agent "${a.name}"? Phiên Claude Code của nó sẽ dừng.`)) {
        this.handlers.onCloseAgent(a.id);
      }
    });
    const status = h('span', { class: 'status-pill' }, a.activity || st.label);
    status.style.setProperty('--status', st.css);
    this.drawerHead.replaceChildren(
      h('div', { class: 'drawer-title' }, this.roleChip(a.roomId), h('b', {}, a.name), status),
      h('div', { class: 'drawer-sub' }, a.cwd),
      h('div', { class: 'drawer-actions' }, kill, close),
    );
  }

  private log(a: AgentInfo): void {
    const t = new Date();
    const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    const item = h(
      'div',
      { class: 'feed-item' },
      h('small', {}, time),
      h('span', {}, h('b', {}, a.name), ` — ${a.activity || STATUS_META[a.status].label}`),
    );
    item.style.setProperty('--status', STATUS_META[a.status].css);
    this.feedList.prepend(item);
    while (this.feedList.childElementCount > 60) this.feedList.lastElementChild?.remove();
  }

  // ── Interactions ────────────────────────────────────────────────────────

  selectView(view: ViewId, notify = true): void {
    this.view = view;
    this.renderNav();
    for (const [v, b] of this.tabButtons) b.classList.toggle('active', v === view);
    if (notify) this.handlers.onView(view);
  }

  openDrawer(id: number): void {
    this.openId = id;
    this.drawer.classList.remove('hidden');
    document.body.classList.add('drawer-open');
    this.render();
  }

  closeDrawer(): void {
    this.openId = null;
    this.drawer.classList.add('hidden');
    document.body.classList.remove('drawer-open');
  }

  private toggle(show: HTMLElement, hide: HTMLElement): void {
    hide.classList.add('hidden');
    show.classList.toggle('hidden');
  }

  private toast(text: string, onClick?: () => void): void {
    const t = h('div', { class: 'toast' }, text);
    if (onClick) {
      t.classList.add('clickable');
      t.addEventListener('click', onClick);
    }
    this.toasts.append(t);
    setTimeout(() => t.remove(), 6000);
  }

  // ── Setup screen ────────────────────────────────────────────────────────

  openSetup(): void {
    this.draft = cloneSetup(this.setup ?? TEMPLATES[0]);
    this.setupScreen.classList.remove('hidden');
    this.renderSetup();
  }

  private renderSetup(): void {
    const d = this.draft;
    const close = () => this.setupScreen.classList.add('hidden');

    const head = h(
      'div',
      { class: 'setup-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'THIẾT LẬP VĂN PHÒNG'), h('h2', {}, 'Hôm nay bạn làm gì?')),
    );
    if (this.setup) {
      const keep = h('button', { class: 'btn-primary' }, `Tiếp tục với "${this.setup.name}"`);
      keep.addEventListener('click', close);
      head.append(keep);
    }

    // Templates + saved setups.
    const pickSetup = (s: Setup) => {
      this.draft = cloneSetup(s);
      this.renderSetup();
    };
    const card = (s: Setup, desc: string, onDelete?: () => void) => {
      const dots = h('div', { class: 'dots' }, ...s.rooms.map((r) => {
        const dot = h('span');
        dot.style.background = r.color;
        dot.title = r.name;
        return dot;
      }));
      const c = h('button', { class: `tpl-card${s.name === d.name ? ' active' : ''}`, type: 'button' }, h('b', {}, s.name), h('small', {}, desc), dots);
      c.addEventListener('click', () => pickSetup(s));
      if (onDelete) {
        const x = h('span', { class: 'tpl-del', title: 'Xoá thiết lập đã lưu' }, '×');
        x.addEventListener('click', (e) => {
          e.stopPropagation();
          onDelete();
        });
        c.append(x);
      }
      return c;
    };
    const savedRow = this.saved.length
      ? [
          h('div', { class: 'setup-label' }, 'Đã lưu'),
          h('div', { class: 'tpl-grid' }, ...this.saved.map((s) => card(s, `${s.rooms.length} phòng`, () => this.handlers.onDeleteSetup(s.name)))),
        ]
      : [];
    const templates = h('div', { class: 'tpl-grid' }, ...TEMPLATES.map((t) => card(t, t.desc)));

    // Room editor.
    const nameInput = h('input', { value: d.name, maxlength: '40', placeholder: 'Tên thiết lập, VD: Bài tập lớn Vi xử lý' });
    nameInput.addEventListener('input', () => (d.name = nameInput.value));
    const rooms = h('div', { class: 'room-editor' }, ...d.rooms.map((r, i) => this.roomEditor(d, r, i)));
    const add = h('button', { class: 'chip', type: 'button' }, '+ Thêm phòng');
    add.disabled = d.rooms.length >= MAX_ROOMS;
    add.addEventListener('click', () => {
      const label = `Phòng ${d.rooms.length + 1}`;
      d.rooms.push({
        id: makeRoomId(label, d.rooms.map((x) => x.id)),
        name: label,
        label: 'Agent',
        color: PALETTE[d.rooms.length % PALETTE.length],
        theme: 'code',
        coordinator: false,
        prompt: 'Bạn là một agent trợ giúp. Làm cẩn thận đúng việc người dùng nhờ và giải thích những gì đã làm.',
      });
      this.renderSetup();
    });
    const go = h('button', { class: 'btn-primary', type: 'button' }, 'Vào văn phòng →');
    go.addEventListener('click', () => {
      d.name = d.name.trim() || 'Văn phòng';
      if (d.rooms.length === 0) return this.toast('Cần ít nhất một phòng');
      this.handlers.onSetup(cloneSetup(d));
      close();
    });
    const note = this.agents.length
      ? h('p', { class: 'muted' }, 'Nhân viên đang làm sẽ chuyển sang phòng mới; ai có phòng bị xoá sẽ sang phòng đầu tiên.')
      : h('p', { class: 'muted' }, `Tối đa ${MAX_ROOMS} phòng làm việc, cộng Pantry. Phòng điều phối được đặt ở góc tầng 1.`);

    this.setupScreen.replaceChildren(
      h(
        'div',
        { class: 'panel setup-card' },
        head,
        ...savedRow,
        h('div', { class: 'setup-label' }, 'Mẫu có sẵn'),
        templates,
        h('div', { class: 'setup-label' }, 'Các phòng'),
        nameInput,
        rooms,
        h('div', { class: 'row between' }, add, note, go),
      ),
    );
  }

  private roomEditor(d: Setup, r: RoomRole, i: number): HTMLElement {
    const swatch = h('button', { class: 'swatch', type: 'button', title: 'Đổi màu' });
    swatch.style.background = r.color;
    swatch.addEventListener('click', () => {
      r.color = PALETTE[(PALETTE.indexOf(r.color) + 1) % PALETTE.length];
      swatch.style.background = r.color;
    });
    const name = h('input', { value: r.name, maxlength: '40', placeholder: 'Tên phòng' });
    name.addEventListener('input', () => (r.name = name.value));
    const label = h('input', { value: r.label, maxlength: '24', placeholder: 'Vai trò' });
    label.addEventListener('input', () => (r.label = label.value));
    const theme = h('select', {}, ...THEMES.map((t) => h('option', { value: t.id }, t.label)));
    theme.value = r.theme;
    theme.addEventListener('change', () => (r.theme = theme.value as Theme));
    const coord = h('input', { type: 'checkbox' });
    coord.checked = r.coordinator;
    coord.addEventListener('change', () => {
      // One coordinator at most: it is the one told about the other rooms.
      d.rooms.forEach((x) => (x.coordinator = false));
      r.coordinator = coord.checked;
      this.renderSetup();
    });
    const prompt = h('textarea', { rows: '2', placeholder: 'Lời dặn cho agent trong phòng này' });
    prompt.value = r.prompt;
    prompt.addEventListener('input', () => (r.prompt = prompt.value));
    const del = h('button', { class: 'icon-btn', type: 'button', title: 'Xoá phòng' }, '×');
    del.addEventListener('click', () => {
      d.rooms.splice(i, 1);
      this.renderSetup();
    });
    return h(
      'div',
      { class: 'room-edit' },
      h('div', { class: 'room-edit-row' }, swatch, name, label, theme, h('label', { class: 'coord' }, coord, 'Điều phối'), del),
      prompt,
    );
  }

  // ── Add-agent dialog ────────────────────────────────────────────────────

  private buildModal(): HTMLDivElement {
    const name = h('input', { placeholder: 'VD: Mèo (để trống sẽ tự đặt)', maxlength: '40' });
    this.dirSelect = h('select');
    const newDir = h('input', { placeholder: 'Hoặc dán đường dẫn thư mục khác, VD: D:\\du-an' });
    const addDir = h('button', { class: 'chip', type: 'button' }, 'Lưu thư mục');
    addDir.addEventListener('click', () => {
      if (newDir.value.trim()) this.handlers.onAddDir(newDir.value.trim());
      newDir.value = '';
    });
    const create = h('button', { class: 'btn-primary', type: 'submit' }, 'Tuyển agent');
    const cancel = h('button', { class: 'chip', type: 'button' }, 'Huỷ');
    const form = h(
      'form',
      { class: 'panel modal-card' },
      h('h2', {}, 'Thêm nhân viên'),
      h('label', {}, 'Tên'),
      name,
      h('label', {}, 'Phòng'),
      this.roomCards,
      h('label', {}, 'Làm việc trong thư mục'),
      this.dirSelect,
      h('div', { class: 'row' }, newDir, addDir),
      h('div', { class: 'row end' }, cancel, create),
    );
    const modal = h('div', { class: 'modal hidden' }, form);
    const hide = () => modal.classList.add('hidden');
    cancel.addEventListener('click', hide);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hide();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cwd = newDir.value.trim() || this.dirSelect.value;
      if (!cwd) return this.toast('Chọn một thư mục làm việc');
      if (!this.chosenRoom) return this.toast('Chọn phòng');
      this.handlers.onCreate(name.value.trim(), this.chosenRoom, cwd);
      name.value = '';
      newDir.value = '';
      hide();
    });
    return modal;
  }

  private renderRoomCards(): void {
    const rooms = this.setup?.rooms ?? [];
    if (!rooms.some((r) => r.id === this.chosenRoom)) this.chosenRoom = rooms.find((r) => !r.coordinator)?.id ?? rooms[0]?.id ?? '';
    this.roomCards.replaceChildren(
      ...rooms.map((r) => {
        const b = h(
          'button',
          { class: `role-card${r.id === this.chosenRoom ? ' active' : ''}`, type: 'button' },
          h('b', {}, r.label),
          h('small', {}, r.name + (r.coordinator ? ' · điều phối' : '')),
          h('span', {}, r.prompt.length > 90 ? `${r.prompt.slice(0, 88)}…` : r.prompt),
        );
        b.style.setProperty('--role', r.color);
        b.addEventListener('click', () => {
          this.chosenRoom = r.id;
          this.renderRoomCards();
        });
        return b;
      }),
    );
  }

  private fillDirs(): void {
    if (!this.dirSelect) return;
    const keep = this.dirSelect.value;
    this.dirSelect.replaceChildren(...this.dirs.map((d) => h('option', { value: d.path }, `${d.name} — ${d.path}`)));
    if (keep && this.dirs.some((d) => d.path === keep)) this.dirSelect.value = keep;
  }

  private openModal(): void {
    if (!this.setup) return this.openSetup();
    this.fillDirs();
    this.renderRoomCards();
    this.modal.classList.remove('hidden');
    this.modal.querySelector('input')?.focus();
  }
}
