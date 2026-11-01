const DEFAULT_CLICKGUI = {
  accent: '#a9c7ff',
  accentAlpha: 28,
  mica: true,
  windowOpacity: 97,
  radius: 35,
  scale: 100,
  language: 'zh',
  animations: true,
  rememberPosition: true,
  windowX: 0,
  windowY: 0
};

const state = {
  modules: [],
  sidebar: {},
  requestId: 1,
  bridgeReady: false,
  pending: new Map(),
  page: 'mods',
  selectedModule: null,
  hudEditing: false,
  openSections: new Set(['core']),
  clickgui: { ...DEFAULT_CLICKGUI },
  wx: 0,
  wy: 0
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const I18N = {
  zh: {
    'nav.mods': '模组',
    'nav.clickgui': 'ClickGUI',
    'nav.settings': '设置',
    'nav.close': '关闭',
    'editHud.title': '编辑 HUD',
    'search.placeholder': '搜索模组或设置',
    'clickgui.title': 'ClickGUI 设置',
    'clickgui.note': '这些设置只影响 ClickGUI 本身，不会写入 Feather 配置。',
    'clickgui.section.appearance': '外观',
    'clickgui.section.window': '窗口',
    'clickgui.section.behavior': '行为',
    'clickgui.accent': '主题色',
    'clickgui.presets': '预设颜色',
    'clickgui.accentAlpha': '主题透明度',
    'clickgui.mica': '透明毛玻璃',
    'clickgui.windowOpacity': '窗口不透明度',
    'clickgui.radius': '窗口圆角',
    'clickgui.scale': '界面缩放',
    'clickgui.language': '语言',
    'clickgui.animations': '界面动画',
    'clickgui.remember': '记住窗口位置',
    'clickgui.resetPosition': '重置窗口位置',
    'clickgui.resetButton': '重置',
    'settings.title': '设置',
    'detail.back': '返回',
    'detail.enable': '启用模组',
    'editor.hint': '拖动 HUD · 滚轮缩放',
    'editor.done': '完成',
    'editor.openSettings': '打开设置',
    'settings.count': '{0} 项',
    'status.loading': '正在读取本地配置...',
    'status.connected': '本地 UI 已连接，改动即时生效',
    'status.ready': '已加载 {0} 个模组，改动即时生效',
    'status.loadFailed': '读取本地配置失败',
    'status.noBridge': 'CEF 桥未连接，改动没有发送',
    'status.cefError': 'CEF 调用失败：{0}',
    'status.hudOpened': 'HUD 编辑器已打开',
    'status.updated': '已更新 {0} · {1}',
    'status.applyFailed': '应用失败：{0}',
    'status.toggleFailed': '切换失败：{0}',
    'status.enabled': '已启用 {0}',
    'status.disabled': '已禁用 {0}',
    'status.hudEditing': 'HUD 编辑模式：拖动画面中的 HUD，滚轮缩放，Esc 返回设置',
    'status.backToSettings': '已返回设置窗口',
    'status.closing': '正在关闭界面...',
    'status.closeFailed': '关闭失败：{0}',
    'status.reset': '已重置 {0} 的位置',
    'status.resetFailed': '重置失败：{0}',
    'status.clickguiUpdated': 'ClickGUI 设置已更新',
    'status.languageChanged': '语言已切换',
    'status.positionReset': '窗口位置已重置',
    'empty.mods': '没有匹配的模组',
    'empty.settings': '没有匹配的设置',
    'empty.moduleSettings': '这个模组没有额外设置',
    'search.results': '搜索结果',
    'search.modules': '模组',
    'search.clientSettings': '客户端设置',
    'search.clickgui': 'ClickGUI',
    'search.noResults': '没有找到匹配项',
    'search.matches': '{0} 个匹配',
    'search.openClickgui': '打开 ClickGUI',
    'search.moduleSettings': '模组设置'
  },
  en: {
    'nav.mods': 'Mods',
    'nav.clickgui': 'ClickGUI',
    'nav.settings': 'Settings',
    'nav.close': 'Close',
    'editHud.title': 'Edit HUD',
    'search.placeholder': 'Search mods or settings',
    'clickgui.title': 'ClickGUI Settings',
    'clickgui.note': 'These options only affect ClickGUI and are not written to Feather config.',
    'clickgui.section.appearance': 'Appearance',
    'clickgui.section.window': 'Window',
    'clickgui.section.behavior': 'Behavior',
    'clickgui.accent': 'Accent color',
    'clickgui.presets': 'Presets',
    'clickgui.accentAlpha': 'Accent transparency',
    'clickgui.mica': 'Mica transparency',
    'clickgui.windowOpacity': 'Window opacity',
    'clickgui.radius': 'Corner radius',
    'clickgui.scale': 'UI scale',
    'clickgui.language': 'Language',
    'clickgui.animations': 'UI animations',
    'clickgui.remember': 'Remember window position',
    'clickgui.resetPosition': 'Reset window position',
    'clickgui.resetButton': 'Reset',
    'settings.title': 'Settings',
    'detail.back': 'Back',
    'detail.enable': 'Enable mod',
    'editor.hint': 'Drag HUD · Scroll to scale',
    'editor.done': 'Done',
    'editor.openSettings': 'Open settings',
    'settings.count': '{0} items',
    'status.loading': 'Loading local config...',
    'status.connected': 'Local UI connected; changes apply live',
    'status.ready': 'Loaded {0} mods; changes apply live',
    'status.loadFailed': 'Failed to load local config',
    'status.noBridge': 'CEF bridge not connected; change not sent',
    'status.cefError': 'CEF call failed: {0}',
    'status.hudOpened': 'HUD editor opened',
    'status.updated': 'Updated {0} · {1}',
    'status.applyFailed': 'Apply failed: {0}',
    'status.toggleFailed': 'Toggle failed: {0}',
    'status.enabled': 'Enabled {0}',
    'status.disabled': 'Disabled {0}',
    'status.hudEditing': 'HUD edit mode: drag HUD, scroll to scale, Esc returns to settings',
    'status.backToSettings': 'Returned to settings',
    'status.closing': 'Closing...',
    'status.closeFailed': 'Close failed: {0}',
    'status.reset': 'Reset {0} position',
    'status.resetFailed': 'Reset failed: {0}',
    'status.clickguiUpdated': 'ClickGUI settings updated',
    'status.languageChanged': 'Language changed',
    'status.positionReset': 'Window position reset',
    'empty.mods': 'No matching mods',
    'empty.settings': 'No matching settings',
    'empty.moduleSettings': 'This mod has no extra settings',
    'search.results': 'Search Results',
    'search.modules': 'Mods',
    'search.clientSettings': 'Client Settings',
    'search.clickgui': 'ClickGUI',
    'search.noResults': 'No results found',
    'search.matches': '{0} matches',
    'search.openClickgui': 'Open ClickGUI',
    'search.moduleSettings': 'Mod settings'
  }
};

const MODULE_NAMES_ZH = {
  fps: 'FPS', coordinates: '坐标', scoreboard: '计分板', potionEffects: '药水效果', bossBar: 'BossBar', bossbar: 'BossBar',
  keystrokes: '按键显示', cps: 'CPS', armorStatus: '装备状态', toggleSprint: '切换疾跑', ping: '延迟', direction: '方向',
  time: '时间', systemresources: '系统资源', serverAddress: '服务器地址', itemCounter: '物品计数', damageIndicator: '伤害指示',
  tablist: 'Tab 列表', subtitles: '字幕', speedMeter: '速度计', tps: 'TPS', reachDisplay: '攻击距离', comboDisplay: '连击',
  playtime: '游玩时间', jumpreset: 'Jump Reset', mousestrokes: '鼠标显示', inventory: '背包 HUD', inventoryHud: '背包 HUD',
  itemInfo1: '物品信息', crosshair: '准星', nametags: '玩家名称', animations: '动画', performance: '性能', graphicsOptions: '画面',
  chatOptions: '聊天', core: '通用', cosmeticOptions: '装饰', social: '在线社交', customChat: '自定义聊天', autoText: '自动文本',
  armorBar: '护甲条', blockIndicator: '方块指示', blockOverlay: '方块覆盖', brightness: '亮度', camera: '视角',
  colorSaturation: '色彩饱和度', customFog: '自定义雾', customF3: '自定义 F3', deathInfo: '死亡信息', discordRP: 'Discord 状态',
  dropprevention: '防丢弃', elytras: '鞘翅', fovChanger: 'FOV 修改', glint: '附魔光效', hearts: '生命值', hitbox: '碰撞箱',
  hitindicator: '命中指示', horses: '马匹状态', itemdespawn: '物品消失', itemPhysic: '物品物理', lightleveloverlay: '光照覆盖',
  lootBeams: '掉落光柱', mobOverlay: '生物覆盖', motionBlur: '动态模糊', packOrganizer: '资源包整理', particles: '粒子',
  playerModel: '玩家模型', reconnect: '自动重连', saturation: '饱和度', screenshot: '截图', shieldstatus: '盾牌状态',
  shulkertooltips: '潜影盒提示', soundfilters: '声音过滤', stopwatch1: '秒表', teamtracker: '队伍追踪', timeChanger: '时间修改',
  titletweaker: '标题调整', tooltips: '提示框', totem: '图腾', uhcoverlay: 'UHC 覆盖', visuals: '视觉效果', waypoints: '路径点',
  weatherChanger: '天气修改', weatherchanger: '天气修改', zoom: '缩放', packdisplay: '资源包显示', tiertagger: '段位标签',
  attackIndicator: '攻击指示', uiScaling: 'UI 缩放', autoperspective: '自动视角', hypixel: 'Hypixel', snaplook: '快速视角',
  viewModel: '手持模型', customadvancementsscreen: '进度界面', autohidehud: '自动隐藏 HUD', backups: '备份',
  culllogs: '日志清理', customfog: '自定义雾', darkmode: '深色模式', jumpreset: '跳跃重置', nickHider: '昵称隐藏',
  perspective: '视角', searchkeybind: '搜索按键', tnttimer: 'TNT 计时', toastcontrol: '提示控制', voice: '语音',
  bossBar: 'Boss 血条', customf3: '自定义 F3'
};

const MODULE_NAMES_EN = {
  fps: 'FPS', coordinates: 'Coordinates', scoreboard: 'Scoreboard', potionEffects: 'Potion Effects', bossBar: 'BossBar',
  bossbar: 'BossBar', keystrokes: 'Keystrokes', cps: 'CPS', armorStatus: 'Armor Status', toggleSprint: 'Toggle Sprint',
  ping: 'Ping', direction: 'Direction', time: 'Time', systemresources: 'System Resources', serverAddress: 'Server Address',
  itemCounter: 'Item Counter', damageIndicator: 'Damage Indicator', tablist: 'Tab List', subtitles: 'Subtitles',
  speedMeter: 'Speed Meter', tps: 'TPS', reachDisplay: 'Reach Display', comboDisplay: 'Combo Display', playtime: 'Playtime',
  jumpreset: 'Jump Reset', mousestrokes: 'Mouse Strokes', inventory: 'Inventory HUD', inventoryHud: 'Inventory HUD',
  itemInfo1: 'Item Info', crosshair: 'Crosshair', nametags: 'Nametags', animations: 'Animations', performance: 'Performance',
  graphicsOptions: 'Graphics', chatOptions: 'Chat', core: 'General', cosmeticOptions: 'Cosmetics', social: 'Social',
  customChat: 'Custom Chat', autoText: 'Auto Text', armorBar: 'Armor Bar', blockIndicator: 'Block Indicator',
  blockOverlay: 'Block Overlay', brightness: 'Brightness', camera: 'Camera', colorSaturation: 'Color Saturation',
  customFog: 'Custom Fog', customF3: 'Custom F3', deathInfo: 'Death Info', discordRP: 'Discord RP', dropprevention: 'Drop Prevention',
  elytras: 'Elytras', fovChanger: 'FOV Changer', glint: 'Glint', hearts: 'Hearts', hitbox: 'Hitbox', hitindicator: 'Hit Indicator',
  horses: 'Horses', itemdespawn: 'Item Despawn', itemPhysic: 'Item Physics', lightleveloverlay: 'Light Level Overlay',
  lootBeams: 'Loot Beams', mobOverlay: 'Mob Overlay', motionBlur: 'Motion Blur', packOrganizer: 'Pack Organizer',
  particles: 'Particles', playerModel: 'Player Model', reconnect: 'Reconnect', saturation: 'Saturation', screenshot: 'Screenshot',
  shieldstatus: 'Shield Status', shulkertooltips: 'Shulker Tooltips', soundfilters: 'Sound Filters', stopwatch1: 'Stopwatch',
  teamtracker: 'Team Tracker', timeChanger: 'Time Changer', titletweaker: 'Title Tweaker', tooltips: 'Tooltips', totem: 'Totem',
  uhcoverlay: 'UHC Overlay', visuals: 'Visuals', waypoints: 'Waypoints', weatherChanger: 'Weather Changer',
  weatherchanger: 'Weather Changer', zoom: 'Zoom', packdisplay: 'Pack Display', tiertagger: 'Tier Tagger',
  attackIndicator: 'Attack Indicator', uiScaling: 'UI Scaling', autoperspective: 'Auto Perspective', hypixel: 'Hypixel',
  snaplook: 'Snap Look', viewModel: 'View Model', customadvancementsscreen: 'Advancements Screen',
  autohidehud: 'Auto Hide HUD', backups: 'Backups', culllogs: 'Cull Logs', customfog: 'Custom Fog',
  darkmode: 'Dark Mode', jumpreset: 'Jump Reset', nickHider: 'Nick Hider', perspective: 'Perspective',
  searchkeybind: 'Search Keybind', tnttimer: 'TNT Timer', toastcontrol: 'Toast Control', voice: 'Voice',
  bossBar: 'BossBar', customf3: 'Custom F3'
};

const SIDEBAR_NAMES = {
  core: { zh: '通用', en: 'General' },
  graphicsOptions: { zh: '画面', en: 'Graphics' },
  chatOptions: { zh: '聊天', en: 'Chat' },
  performanceOptions: { zh: '性能', en: 'Performance' },
  cosmeticOptions: { zh: '装饰', en: 'Cosmetics' },
  social: { zh: '在线社交', en: 'Social' }
};

const SETTING_NAMES_ZH = {
  enabled: '启用', hudEnabled1: 'HUD 显示', hudAnchor: 'HUD 锚点', hudRelativeX: 'HUD X', hudRelativeY: 'HUD Y',
  hudScale: 'HUD 缩放', backgroundColor: '背景颜色', textColor: '文字颜色', border: '边框', borderColor: '边框颜色',
  borderThickness1: '边框粗细', textShadow: '文字阴影', displayMode: '显示模式', background: '背景', scale: '缩放',
  color: '颜色', width: '宽度', height: '高度', opacity: '不透明度', animationSpeed: '动画速度', horizontalPadding: '水平内边距',
  verticalPadding: '垂直内边距', backgroundWidth: '背景宽度', backgroundHeight: '背景高度', xOffset: 'X 偏移', yOffset: 'Y 偏移',
  alignment: '对齐', orientation: '方向', showIcon: '显示图标', showText: '显示文字', showPercentage: '显示百分比',
  showNumbers: '显示数字', showBackground: '显示背景', roundedCorners: '圆角', shadow: '阴影', reverse: '反向',
  onlySelf: '仅显示自己', showWings: '显示翅膀', showHats: '显示帽子', showPets: '显示宠物', showArm: '显示手臂',
  showFace: '显示面部', showBack: '显示背部', showBoots: '显示靴子', showAuras: '显示光环', showShields: '显示盾牌'
};

const SETTING_LABELS = {
  enabled: { zh: '启用', en: 'Enabled' },
  hudEnabled1: { zh: 'HUD 显示', en: 'HUD Visible' },
  hudAnchor: { zh: 'HUD 锚点', en: 'HUD Anchor' },
  hudRelativeX: { zh: 'HUD X 偏移', en: 'HUD X Offset' },
  hudRelativeY: { zh: 'HUD Y 偏移', en: 'HUD Y Offset' },
  hudScale: { zh: 'HUD 缩放', en: 'HUD Scale' },
  coreModToggleKey: { zh: '模组开关按键', en: 'Mod Toggle Key' },
  coreModToggleKeyNotify: { zh: '切换提示', en: 'Toggle Notification' },
  displayMode: { zh: '显示模式', en: 'Display Mode' },
  backgroundType: { zh: '背景类型', en: 'Background Type' },
  backgroundColor: { zh: '背景颜色', en: 'Background Color' },
  textColor: { zh: '文字颜色', en: 'Text Color' },
  borderColor: { zh: '边框颜色', en: 'Border Color' },
  borderThickness1: { zh: '边框粗细', en: 'Border Thickness' },
  textShadow: { zh: '文字阴影', en: 'Text Shadow' },
  textShadow1: { zh: '文字阴影', en: 'Text Shadow' },
  textAlignment: { zh: '文本对齐', en: 'Text Alignment' },
  textAlignment1: { zh: '文本对齐', en: 'Text Alignment' },
  horizontalPadding: { zh: '水平内边距', en: 'Horizontal Padding' },
  verticalPadding: { zh: '垂直内边距', en: 'Vertical Padding' },
  backgroundWidth: { zh: '背景宽度', en: 'Background Width' },
  backgroundHeight: { zh: '背景高度', en: 'Background Height' },
  hudSelection: { zh: 'HUD 选择', en: 'HUD Selection' },
  hud: { zh: 'HUD', en: 'HUD' },
  requireDamageableForHands: { zh: '仅对有耐久物品生效', en: 'Only damageable items' },
  doFeatherTranslation: { zh: 'Feather 翻译', en: 'Feather Translation' },
  holdingScreen: { zh: '手持光源界面', en: 'Holding Light Screen' },
  streamlineOther: { zh: '精简其他', en: 'Streamline Other' },
  ggString: { zh: 'GG 文本', en: 'GG Text' },
  decimalPlaces: { zh: '小数位', en: 'Decimal Places' }
};

const PART_NAMES = {
  helmet: { zh: '头盔', en: 'Helmet' },
  chestplate: { zh: '胸甲', en: 'Chestplate' },
  leggings: { zh: '护腿', en: 'Leggings' },
  boots: { zh: '靴子', en: 'Boots' },
  bootsConfig: { zh: '靴子', en: 'Boots' },
  mainhand: { zh: '主手', en: 'Main hand' },
  offhand: { zh: '副手', en: 'Off hand' },
  saturation: { zh: '饱和度', en: 'Saturation' },
  inventoryHud: { zh: '背包 HUD', en: 'Inventory HUD' },
  hotbarKeybinds: { zh: '快捷栏按键', en: 'Hotbar Keybinds' },
  itemPickup: { zh: '物品拾取', en: 'Item Pickup' }
};

const WORD_ZH = {
  a: '一个', above: '上方', actionbar: '动作栏', active: '激活', add: '添加', address: '地址', alert: '警报',
  align: '对齐', alignment: '对齐', all: '全部', allocation: '分配', ally: '队友', alpha: '透明度', always: '始终',
  ambient: '环境', amount: '数量', amplifier: '等级', anchor: '锚点', angle: '角度', animal: '动物', animation: '动画',
  animations: '动画', anti: '防', armor: '护甲', attack: '攻击', audio: '音频', aura: '光环', auras: '光环',
  auto: '自动', avatar: '头像', avatars: '头像', back: '背部', background: '背景', backup: '备份', backups: '备份',
  bad: '差', banners: '横幅', bar: '条', beam: '光柱', biome: '生物群系', blast: '爆炸', block: '方块', blocks: '方块',
  blur: '模糊', border: '边框', borderless: '无边框', bottom: '底部', bow: '弓', bright: '亮', brightness: '亮度',
  bubble: '气泡', bubbles: '气泡', button: '按钮', cache: '缓存', camera: '视角', cape: '披风', carry: '携带',
  center: '中心', chat: '聊天', chestplate: '胸甲', chunk: '区块', circular: '圆形', clear: '清除', click: '点击',
  clicks: '点击', client: '客户端', cloak: '披风', codes: '代码', color: '颜色', colors: '颜色', combo: '连击',
  compass: '指南针', consecutive: '连续', container: '容器', contrast: '对比度', control: '控制', cooldown: '冷却',
  coordinates: '坐标', copy: '复制', corner: '角', corners: '角', count: '计数', counter: '计数器', country: '国家',
  cpu: 'CPU', cps: 'CPS', create: '创建', crit: '暴击', crosshair: '准星', cull: '剔除', current: '当前',
  custom: '自定义', damage: '伤害', dark: '深色', date: '日期', day: '天', days: '天', death: '死亡',
  decimals: '小数位', delete: '删除', delay: '延迟', density: '密度', description: '描述', detach: '分离',
  difficulty: '难度', digit: '位数', digits: '位数', dimension: '维度', direct: '直接', direction: '方向',
  disable: '禁用', disabled: '禁用', display: '显示', distance: '距离', dot: '点', down: '下', drag: '拖动',
  drop: '掉落', durability: '耐久', duration: '持续时间', dust: '尘埃', dynamic: '动态', edge: '边缘',
  edgeless: '无边框', editor: '编辑器', effect: '效果', effects: '效果', emerald: '绿宝石', enable: '启用',
  enabled: '启用', enchant: '附魔', enchantment: '附魔', enchantments: '附魔', ender: '末影', entity: '实体',
  entry: '条目', equipment: '装备', events: '事件', explosion: '爆炸', explosions: '爆炸', eye: '眼睛',
  facing: '朝向', fade: '淡入淡出', falling: '下落', fast: '快速', favorite: '收藏', feather: 'Feather',
  fire: '火焰', first: '第一', fishing: '钓鱼', flash: '闪烁', fly: '飞行', flying: '飞行', fog: '雾',
  folders: '文件夹', food: '饥饿', force: '强制', formatting: '格式', fps: 'FPS', friend: '好友', from: '从',
  full: '完整', fullscreen: '全屏', game: '游戏', gamemode: '游戏模式', gap: '间隙', gapple: '金苹果', geolocation: '地理位置',
  gl: 'GL', glow: '发光', gold: '金', gravity: '重力', gui: 'GUI', hand: '手', hats: '帽子', head: '头部',
  health: '生命值', heart: '生命值', hearts: '生命值', height: '高度', helmet: '头盔', hide: '隐藏',
  highlight: '高亮', hit: '命中', hitbox: '碰撞箱', hitboxes: '碰撞箱', hold: '按住', horse: '马', horses: '马',
  hotbar: '快捷栏', hud: 'HUD', hunger: '饥饿', hurt: '受伤', icon: '图标', idle: '空闲', ignore: '忽略',
  in: '在', inactive: '非活动', indicator: '指示器', info: '信息', intensity: '强度', inventory: '背包',
  invisible: '隐身', item: '物品', items: '物品', java: 'Java', join: '加入', jump: '跳跃', key: '按键',
  keybind: '按键绑定', keybinds: '按键绑定', kill: '击杀', label: '标签', language: '语言', lava: '岩浆',
  layer: '层', leave: '离开', left: '左', leggings: '护腿', level: '等级', life: '生命', lifetime: '寿命',
  light: '光', lighting: '光照', line: '线', list: '列表', load: '加载', location: '位置', looping: '循环',
  low: '低', magnet: '磁吸', mainhand: '主手', map: '地图', marker: '标记', max: '最大', memory: '内存',
  mention: '提及', menu: '菜单', message: '消息', messages: '消息', microphone: '麦克风', milli: '毫秒',
  minecraft: 'Minecraft', min: '最小', minutes: '分钟', mode: '模式', modifier: '修改器', mods: '模组',
  monster: '怪物', mouse: '鼠标', movement: '移动', multiplier: '倍率', music: '音乐', name: '名称',
  nametag: '名称标签', nametags: '名称标签', natural: '自然', night: '夜晚', no: '无', normal: '正常',
  notification: '通知', notifications: '通知', number: '数字', numbers: '数字', off: '关闭', offhand: '副手',
  offset: '偏移', on: '开启', only: '仅', opacity: '不透明度', open: '打开', option: '选项', options: '选项',
  orientation: '方向', outline: '轮廓', own: '自己', padding: '内边距', particle: '粒子', particles: '粒子',
  party: '队伍', pause: '暂停', percentage: '百分比', perspective: '视角', pet: '宠物', pets: '宠物',
  ping: '延迟', pixel: '像素', place: '地点', player: '玩家', players: '玩家', playtime: '游玩时间',
  portal: '传送门', position: '位置', potion: '药水', prefix: '前缀', preview: '预览', projectile: '投掷物',
  proximity: '附近', ptt: 'PTT', quality: '质量', radius: '半径', ram: 'RAM', range: '范围', rarity: '稀有度',
  real: '真实', receive: '接收', record: '唱片', reflection: '反射', remove: '移除', render: '渲染',
  rendering: '渲染', reset: '重置', resolution: '分辨率', reverb: '混响', right: '右', ring: '圆环',
  rotation: '旋转', rounded: '圆角', row: '行', safe: '安全', saturation: '饱和度', save: '保存', scale: '缩放',
  scheduled: '计划', screenshot: '截图', scroll: '滚动', scrollback: '滚动记录', search: '搜索', second: '第二',
  seconds: '秒', see: '看见', selected: '选中', sensitivity: '灵敏度', server: '服务器', shadow: '阴影',
  shape: '形状', shield: '盾牌', shields: '盾牌', shine: '光泽', show: '显示', side: '侧面', size: '大小',
  skin: '皮肤', skull: '头颅', slime: '史莱姆', slot: '槽位', slow: '慢', slowness: '缓慢', smooth: '平滑',
  snap: '吸附', sneak: '潜行', sound: '声音', sounds: '声音', spawner: '刷怪笼', speaker: '扬声器',
  speed: '速度', spyglass: '望远镜', stack: '堆叠', start: '开始', static: '静态', stat: '属性', stats: '属性',
  step: '步长', stop: '停止', strength: '强度', subtitle: '字幕', subtitles: '字幕', suffix: '后缀',
  swing: '挥动', swiftness: '迅捷', swimming: '游泳', tab: 'Tab', tablist: 'Tab 列表', target: '目标',
  team: '队伍', text: '文本', texture: '纹理', thickness: '粗细', thunder: '雷雨', tick: '刻', time: '时间',
  timestamp: '时间戳', timestamps: '时间戳', title: '标题', toast: '提示', toasts: '提示', toggle: '切换',
  tooltip: '提示框', tooltips: '提示框', top: '顶部', totem: '图腾', track: '追踪', tracker: '追踪',
  trash: '回收站', trigger: '触发', triggers: '触发', trims: '饰纹', tutorial: '教程', type: '类型',
  unlimited: '无限', up: '上', upload: '上传', use: '使用', value: '数值', values: '数值', vanilla: '原版',
  vehicle: '载具', velocity: '速度', vertical: '垂直', view: '视角', vision: '视觉', voice: '语音',
  volume: '音量', warning: '警告', water: '水', waypoint: '路径点', waypoints: '路径点', weapon: '武器',
  weather: '天气', when: '当', wings: '翅膀', world: '世界', x: 'X', xp: '经验', y: 'Y', z: 'Z', zoom: '缩放',
  activate: '激活', and: '和', animate: '动画', attempts: '尝试次数', coloration: '着色', damageable: '可损坏',
  debug: '调试', decimal: '小数', degrees: '角度', drinking: '饮水', easing: '缓动', eating: '进食',
  enchants: '附魔', elytra: '鞘翅', fake: '伪造', fill: '填充', filter: '过滤', for: '用于', glint: '光效',
  hands: '手', holding: '手持', hoist: '提升', hover: '悬停', hue: '色相', increment: '增量', input: '输入',
  invert: '反转', leaf: '树叶', liquid: '液体', margin: '边距', mark: '标记', mult: '倍率', nick: '昵称',
  ore: '矿石', other: '其他', percent: '百分比', physics: '物理', pickaxe: '镐', pitch: '俯仰', places: '位',
  poll: '轮询', pop: '弹出', pots: '药水', protection: '保护', rate: '速率', reconnect: '重连', require: '需要',
  reversed: '反转', rod: '钓竿', rot: '旋转', scaling: '缩放', self: '自己', shiny: '发光', skip: '跳过',
  source: '来源', sparkle: '闪光', spacing: '间距', streamline: '精简', sword: '剑', tier: '段位',
  ticks: '刻', visible: '可见', width: '宽度', yaw: '偏航', zero: '零', sneaking: '潜行', autoreconnect: '自动重连'
};

const MODULE_ICONS = {
  fps: 'speed', coordinates: 'my_location', scoreboard: 'leaderboard', potionEffects: 'science', bossBar: 'crop_landscape',
  keystrokes: 'keyboard', cps: 'ads_click', armorStatus: 'shield', toggleSprint: 'directions_run', ping: 'network_ping',
  direction: 'explore', time: 'schedule', systemresources: 'memory', serverAddress: 'dns', itemCounter: 'inventory_2',
  damageIndicator: 'crisis_alert', tablist: 'list', subtitles: 'subtitles', speedMeter: 'speed', tps: 'timer',
  reachDisplay: 'straighten', comboDisplay: 'bolt', playtime: 'hourglass_top', mousestrokes: 'mouse', inventory: 'backpack',
  inventoryHud: 'backpack', itemInfo1: 'info', crosshair: 'add', nametags: 'badge', animations: 'animation',
  performance: 'speed', graphicsOptions: 'palette', chatOptions: 'chat', core: 'settings', cosmeticOptions: 'checkroom',
  social: 'group', customChat: 'forum', autoText: 'keyboard_alt', armorBar: 'shield', blockIndicator: 'view_in_ar',
  blockOverlay: 'layers', brightness: 'brightness_6', camera: 'videocam', customFog: 'foggy', customF3: 'bug_report',
  deathInfo: 'dangerous', discordRP: 'discord', dropprevention: 'block', elytras: 'air', glint: 'auto_awesome',
  hearts: 'favorite', hitbox: 'select_all', hitindicator: 'ads_click', horses: 'pets', itemdespawn: 'hourglass_empty',
  itemPhysic: 'toys', lightleveloverlay: 'light_mode', lootBeams: 'flare', mobOverlay: 'pest_control', motionBlur: 'blur_on',
  particles: 'scatter_plot', playerModel: 'accessibility_new', reconnect: 'refresh', saturation: 'restaurant',
  screenshot: 'photo_camera', shieldstatus: 'verified_user', shulkertooltips: 'inventory_2', soundfilters: 'graphic_eq',
  stopwatch1: 'timer', teamtracker: 'groups', timeChanger: 'wb_twilight', titletweaker: 'title', tooltips: 'info',
  totem: 'workspace_premium', uhcoverlay: 'local_hospital', visuals: 'auto_awesome', waypoints: 'flag',
  weatherChanger: 'cloud', weatherchanger: 'cloud', zoom: 'zoom_in', packdisplay: 'inventory', tiertagger: 'military_tech',
  attackIndicator: 'swords', uiScaling: 'aspect_ratio'
};

const ENUM_OPTIONS = {
  hudAnchor: ['top_left', 'top_right', 'top_center', 'bottom_left', 'bottom_right', 'bottom_center', 'center_left', 'center_right'],
  fastFontRenderer: ['vanilla', 'direct', 'cached'],
  displayMode: ['justText', 'background', 'brackets'],
  backgroundType: ['static', 'dynamic'],
  orientation: ['horizontal', 'vertical'],
  alignment: ['left', 'center', 'right'],
  type: ['default', 'cross', 'circle', 'square', 'drawn', 'arrow'],
  timeFormat: ['12', '24'],
  colorType: ['safe_unsafe_gradient', 'number', 'none'],
  uiQuality: ['ultra', 'high', 'medium', 'low'],
  chromaMode: ['normal', 'breathing'],
  serverCountryPlacement: ['bottom', 'top', 'right'],
  featherIconPlacement: ['bottomright', 'aboveinventory', 'belowinventory'],
  modPreviewBackground: ['mountains', 'ocean', 'skyblock', 'stone'],
  lazyChunkLoading: ['off', 'low', 'medium', 'high'],
  mentionTextColor: ['black', 'darkBlue', 'darkGreen', 'darkAqua', 'darkRed', 'darkPurple', 'gold', 'gray', 'darkGray', 'blue', 'green', 'aqua', 'red', 'lightPurple', 'yellow', 'white']
};

const ACCENT_PRESETS = ['#a9c7ff', '#c9b6ff', '#ff9eb5', '#9ff0c4', '#ffd28a', '#f0a6ff'];
const CLICKGUI_KEYS = [
  'clickgui.accent', 'clickgui.presets', 'clickgui.accentAlpha', 'clickgui.mica',
  'clickgui.windowOpacity', 'clickgui.radius', 'clickgui.scale', 'clickgui.language',
  'clickgui.animations', 'clickgui.remember', 'clickgui.resetPosition'
];

function t(key, ...args) {
  const dict = I18N[state.clickgui.language] || I18N.zh;
  let text = dict[key] ?? I18N.zh[key] ?? key;
  args.forEach((value, index) => {
    text = text.replaceAll(`{${index}}`, String(value));
  });
  return text;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function humanize(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function moduleNameIn(id, lang) {
  return lang === 'en'
    ? (MODULE_NAMES_EN[id] || humanize(id))
    : (MODULE_NAMES_ZH[id] || humanize(id));
}

function moduleName(id) {
  return moduleNameIn(id, state.clickgui.language);
}

function moduleSearchText(id) {
  return `${id} ${moduleNameIn(id, 'zh')} ${moduleNameIn(id, 'en')}`.toLowerCase();
}

function moduleMatches(module, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (moduleSearchText(module.id).includes(needle)) return true;
  return Object.keys(module.settings).some((key) => key !== '**ArbitraryData**' && settingSearchText(key).includes(needle));
}

function moduleIcon(id) {
  return MODULE_ICONS[id] || 'extension';
}

function sidebarNameIn(section, lang) {
  const names = SIDEBAR_NAMES[section];
  return names ? names[lang] || names.zh : humanize(section);
}

function sidebarName(section) {
  return sidebarNameIn(section, state.clickgui.language);
}

function autoTranslateZh(key) {
  const match = String(key).match(/^(.*?)(\d+)$/);
  const base = match ? match[1] : String(key);
  const suffix = match ? match[2] : '';
  const words = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_]+/).filter(Boolean);
  let translatedAny = false;
  const parts = words.map((word) => {
    const translated = WORD_ZH[word.toLowerCase()];
    if (translated) {
      translatedAny = true;
      return translated;
    }
    return word;
  });
  return translatedAny ? `${parts.join('')}${suffix}` : humanize(key);
}

function settingNameIn(key, lang) {
  const colon = key.indexOf(':');
  if (colon > 0) {
    const prefix = key.slice(0, colon);
    const base = key.slice(colon + 1);
    const part = PART_NAMES[prefix] ? PART_NAMES[prefix][lang] : moduleNameIn(prefix, lang);
    return `${part} · ${settingNameIn(base, lang)}`;
  }
  const label = SETTING_LABELS[key];
  if (label) return label[lang] || label.zh;
  return lang === 'zh' ? autoTranslateZh(key) : humanize(key);
}

function settingName(key) {
  return settingNameIn(key, state.clickgui.language);
}

function settingSearchText(key) {
  return `${key} ${settingNameIn(key, 'zh')} ${settingNameIn(key, 'en')}`.toLowerCase();
}

function status(text, error = false) {
  const el = $('#status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', error);
}

function send(callType, message, onReply) {
  const requestId = state.requestId++;
  const payload = JSON.stringify({ requestId, callType, message });
  try {
    if (!window.fcef || typeof window.fcef.postMessage !== 'function') {
      status(t('status.noBridge'), true);
      return null;
    }
    if (onReply) state.pending.set(requestId, onReply);
    window.fcef.postMessage(payload);
    return requestId;
  } catch (error) {
    status(t('status.cefError', error.message), true);
    return null;
  }
}

function toFe(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (error) {
    console.error('Invalid CEF message', raw, error);
    return;
  }
  if (message.requestId && state.pending.has(message.requestId)) {
    const callback = state.pending.get(message.requestId);
    state.pending.delete(message.requestId);
    callback(message);
  }
}

function initBridge() {
  if (state.bridgeReady) return;
  try {
    if (window.fcef && typeof window.fcef.registerCallback === 'function') {
      window.fcef.registerCallback(toFe);
      state.bridgeReady = true;
      send('readyForMessages', null);
      status(t('status.connected'));
      return;
    }
  } catch (error) {
    console.error('CEF callback registration failed', error);
  }
  setTimeout(initBridge, 150);
}

function inferType(key, value) {
  if (ENUM_OPTIONS[key]) return 'enum';
  if (value === 'true' || value === 'false') return 'bool';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  return 'text';
}

function convertValue(value, type) {
  if (type === 'bool') return value === true || value === 'true';
  if (type === 'number') return Number(value);
  return String(value);
}

function switchMarkup(attrs, checked) {
  return `<label class="switch"><input type="checkbox" ${attrs} ${checked ? 'checked' : ''}><span class="track"></span></label>`;
}

function renderControl(key, value, attrs) {
  const type = inferType(key, value);
  const data = `${attrs} data-key="${esc(key)}" data-type="${type}"`;
  if (type === 'bool') return switchMarkup(data, value === 'true');
  if (type === 'enum') {
    const values = ENUM_OPTIONS[key];
    const list = values.includes(value) ? values : [value, ...values];
    return `<select ${data}>${list.map((item) => `<option value="${esc(item)}" ${item === value ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select>`;
  }
  if (type === 'number') return `<input type="number" step="any" value="${esc(value)}" ${data}>`;
  return `<input type="text" value="${esc(value)}" ${data}>`;
}

function renderSettingRow(key, value, attrs) {
  return `<div class="setting-row">
    <div class="setting-icon"><span class="ms">tune</span></div>
    <div class="setting-main"><div class="setting-name">${esc(settingName(key))}</div><div class="setting-key">${esc(key)}</div></div>
    <div class="setting-control">${renderControl(key, String(value), attrs)}</div>
  </div>`;
}

function renderMods() {
  const query = $('#search').value.trim().toLowerCase();
  const modules = state.modules.filter((module) => moduleMatches(module, query));
  $('#modsGrid').innerHTML = modules.map((module) => `<section class="mod-card ${module.enabled ? 'enabled' : ''}" data-open-mod="${esc(module.id)}">
      <label class="switch mod-toggle" title="${esc(t('detail.enable'))}">
        <input type="checkbox" data-kind="mod-enabled" data-id="${esc(module.id)}" ${module.enabled ? 'checked' : ''}>
        <span class="track"></span>
      </label>
      <div class="mod-icon"><span class="ms ${module.enabled ? 'fill' : ''}">${moduleIcon(module.id)}</span></div>
      <div class="mod-name">${esc(moduleName(module.id))}</div>
    </section>`).join('') || `<div class="empty">${esc(t('empty.mods'))}</div>`;
}

function renderSidebar() {
  const query = $('#search').value.trim().toLowerCase();
  const sections = Object.entries(state.sidebar)
    .filter(([section]) => section !== 'social')
    .map(([section, values]) => {
      const sectionText = `${section} ${sidebarNameIn(section, 'zh')} ${sidebarNameIn(section, 'en')}`.toLowerCase();
      const entries = Object.entries(values).filter(([key]) => key !== '**ArbitraryData**' && (!query || sectionText.includes(query) || settingSearchText(key).includes(query)));
      return { section, values, entries };
    })
    .filter((entry) => entry.entries.length > 0);

  $('#settingsList').innerHTML = sections.map(({ section, values, entries }) => {
    const open = query || state.openSections.has(section);
    return `<section class="section-card ${open ? 'open' : ''}" data-section="${esc(section)}">
      <div class="section-head" data-toggle-section="${esc(section)}">
        <div class="setting-icon"><span class="ms">${sectionIcon(section)}</span></div>
        <div class="section-title"><strong>${esc(sidebarName(section))}</strong><span>${esc(section)} · ${esc(t('settings.count', Object.keys(values).filter((key) => key !== '**ArbitraryData**').length))}</span></div>
        <span class="ms chev">chevron_right</span>
      </div>
      <div class="section-body">${entries.map(([key, value]) => renderSettingRow(key, value, `data-kind="sidebar-setting" data-section="${esc(section)}"`)).join('')}</div>
    </section>`;
  }).join('') || `<div class="empty">${esc(t('empty.settings'))}</div>`;
}

function sectionIcon(section) {
  return { core: 'settings', graphicsOptions: 'palette', chatOptions: 'chat', performanceOptions: 'speed', cosmeticOptions: 'checkroom' }[section] || 'tune';
}

function clickguiRow(labelKey, control, sub = '') {
  return `<div class="setting-row">
    <div class="setting-icon"><span class="ms">tune</span></div>
    <div class="setting-main"><div class="setting-name">${esc(t(labelKey))}</div><div class="setting-key">${esc(sub)}</div></div>
    <div class="setting-control">${control}</div>
  </div>`;
}

function clickguiSection(titleKey, icon, rows) {
  return `<section class="section-card open">
    <div class="section-head">
      <div class="setting-icon"><span class="ms">${icon}</span></div>
      <div class="section-title"><strong>${esc(t(titleKey))}</strong><span>ClickGUI</span></div>
    </div>
    <div class="section-body">${rows.join('')}</div>
  </section>`;
}

function renderClickGui() {
  const cg = state.clickgui;
  const presets = ACCENT_PRESETS.map((color) => `<button class="preset ${color.toLowerCase() === cg.accent.toLowerCase() ? 'selected' : ''}" data-cg-accent="${esc(color)}" style="background:${esc(color)}" title="${esc(color)}"></button>`).join('');

  const appearance = clickguiSection('clickgui.section.appearance', 'palette', [
    clickguiRow('clickgui.accent', `<input type="color" data-cg="accent" value="${esc(cg.accent)}">`, cg.accent),
    clickguiRow('clickgui.presets', `<div class="preset-row">${presets}</div>`),
    clickguiRow('clickgui.accentAlpha', `<input type="range" min="0" max="100" step="1" data-cg="accentAlpha" value="${cg.accentAlpha}"><span class="range-value" data-cg-value="accentAlpha">${cg.accentAlpha}%</span>`),
    clickguiRow('clickgui.mica', switchMarkup('data-cg="mica"', cg.mica))
  ]);

  const windowSection = clickguiSection('clickgui.section.window', 'desktop_windows', [
    clickguiRow('clickgui.windowOpacity', `<input type="range" min="35" max="100" step="1" data-cg="windowOpacity" value="${cg.windowOpacity}"><span class="range-value" data-cg-value="windowOpacity">${cg.windowOpacity}%</span>`),
    clickguiRow('clickgui.radius', `<input type="range" min="0" max="35" step="1" data-cg="radius" value="${cg.radius}"><span class="range-value" data-cg-value="radius">${cg.radius}px</span>`),
    clickguiRow('clickgui.scale', `<input type="range" min="70" max="120" step="1" data-cg="scale" value="${cg.scale}"><span class="range-value" data-cg-value="scale">${cg.scale}%</span>`),
    clickguiRow('clickgui.remember', switchMarkup('data-cg="rememberPosition"', cg.rememberPosition)),
    clickguiRow('clickgui.resetPosition', `<button class="pill" data-cg-action="resetPosition">${esc(t('clickgui.resetButton'))}</button>`)
  ]);

  const behavior = clickguiSection('clickgui.section.behavior', 'translate', [
    clickguiRow('clickgui.language', `<select data-cg="language"><option value="zh" ${cg.language === 'zh' ? 'selected' : ''}>中文</option><option value="en" ${cg.language === 'en' ? 'selected' : ''}>English</option></select>`),
    clickguiRow('clickgui.animations', switchMarkup('data-cg="animations"', cg.animations))
  ]);

  $('#clickguiList').innerHTML = appearance + windowSection + behavior;
}

function renderClickGuiFiltered() {
  const cg = state.clickgui;
  const query = $('#search').value.trim().toLowerCase();
  const presets = ACCENT_PRESETS.map((color) => `<button class="preset ${color.toLowerCase() === cg.accent.toLowerCase() ? 'selected' : ''}" data-cg-accent="${esc(color)}" style="background:${esc(color)}" title="${esc(color)}"></button>`).join('');
  const labelMatch = (key) => !query || [key, t(key), I18N.zh[key], I18N.en[key]].join(' ').toLowerCase().includes(query);
  const row = (key, control, sub = '') => ({ key, html: clickguiRow(key, control, sub) });
  const section = (titleKey, icon, rows) => {
    const titleMatch = !query || [titleKey, t(titleKey), I18N.zh[titleKey], I18N.en[titleKey]].join(' ').toLowerCase().includes(query);
    const filtered = titleMatch ? rows : rows.filter((item) => labelMatch(item.key));
    return filtered.length ? clickguiSection(titleKey, icon, filtered.map((item) => item.html)) : '';
  };

  const appearance = section('clickgui.section.appearance', 'palette', [
    row('clickgui.accent', `<input type="color" data-cg="accent" value="${esc(cg.accent)}">`, cg.accent),
    row('clickgui.presets', `<div class="preset-row">${presets}</div>`),
    row('clickgui.accentAlpha', `<input type="range" min="0" max="100" step="1" data-cg="accentAlpha" value="${cg.accentAlpha}"><span class="range-value" data-cg-value="accentAlpha">${cg.accentAlpha}%</span>`),
    row('clickgui.mica', switchMarkup('data-cg="mica"', cg.mica))
  ]);

  const windowSection = section('clickgui.section.window', 'desktop_windows', [
    row('clickgui.windowOpacity', `<input type="range" min="35" max="100" step="1" data-cg="windowOpacity" value="${cg.windowOpacity}"><span class="range-value" data-cg-value="windowOpacity">${cg.windowOpacity}%</span>`),
    row('clickgui.radius', `<input type="range" min="0" max="35" step="1" data-cg="radius" value="${cg.radius}"><span class="range-value" data-cg-value="radius">${cg.radius}px</span>`),
    row('clickgui.scale', `<input type="range" min="70" max="120" step="1" data-cg="scale" value="${cg.scale}"><span class="range-value" data-cg-value="scale">${cg.scale}%</span>`),
    row('clickgui.remember', switchMarkup('data-cg="rememberPosition"', cg.rememberPosition)),
    row('clickgui.resetPosition', `<button class="pill" data-cg-action="resetPosition">${esc(t('clickgui.resetButton'))}</button>`)
  ]);

  const behavior = section('clickgui.section.behavior', 'translate', [
    row('clickgui.language', `<select data-cg="language"><option value="zh" ${cg.language === 'zh' ? 'selected' : ''}>中文</option><option value="en" ${cg.language === 'en' ? 'selected' : ''}>English</option></select>`),
    row('clickgui.animations', switchMarkup('data-cg="animations"', cg.animations))
  ]);

  $('#clickguiList').innerHTML = [appearance, windowSection, behavior].filter(Boolean).join('') || `<div class="empty">${esc(t('empty.settings'))}</div>`;
}

function openModule(id) {
  const module = state.modules.find((item) => item.id === id);
  if (!module) return;
  state.selectedModule = id;
  $('#detailTitle').textContent = moduleName(id);
  $('#detailId').textContent = id;
  $('#detailEnabled').checked = module.enabled;
  renderModuleDetailContent(id, $('#search').value.trim());
  $('#moduleDetail').classList.add('open');
  $('#pages').scrollTop = 0;
}

function renderModuleDetailContent(id, query = '') {
  const module = state.modules.find((item) => item.id === id);
  if (!module) return;
  const needle = query.toLowerCase();
  const moduleMatchesQuery = !needle || moduleSearchText(id).includes(needle);
  const entries = Object.entries(module.settings)
    .filter(([key]) => key !== 'enabled' && key !== '**ArbitraryData**')
    .filter(([key]) => !needle || moduleMatchesQuery || settingSearchText(key).includes(needle));
  $('#detailSettings').innerHTML = entries.map(([key, value]) => renderSettingRow(key, value, `data-kind="mod-setting" data-id="${esc(id)}"`)).join('') || `<div class="empty">${esc(t('empty.moduleSettings'))}</div>`;
}

function closeModule() {
  state.selectedModule = null;
  $('#moduleDetail').classList.remove('open');
}

function showPage(page) {
  state.page = page;
  if ($('#search').value.trim()) $('#search').value = '';
  closeModule();
  $$('.rail-item[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  $$('.page').forEach((item) => item.classList.toggle('active', item.id === `page-${page}`));
  renderCurrentPage();
}

function renderCurrentPage() {
  const query = $('#search').value.trim();
  if (query) {
    renderSearchResults(query);
    return;
  }
  $$('.page').forEach((item) => item.classList.toggle('active', item.id === `page-${state.page}`));
  if (state.page === 'mods') renderMods();
  else if (state.page === 'clickgui') renderClickGuiFiltered();
  else if (state.page === 'settings') renderSidebar();
}

function renderSearchResults(query) {
  const needle = query.toLowerCase();
  const moduleResults = [];
  for (const module of state.modules) {
    const nameMatch = moduleSearchText(module.id).includes(needle);
    const settingMatches = Object.entries(module.settings)
      .filter(([key]) => key !== '**ArbitraryData**' && settingSearchText(key).includes(needle))
      .map(([key]) => key);
    if (nameMatch || settingMatches.length) moduleResults.push({ module, nameMatch, settingMatches });
  }

  const sidebarResults = [];
  for (const [section, values] of Object.entries(state.sidebar)) {
    if (section === 'social') continue;
    const sectionMatch = `${section} ${sidebarNameIn(section, 'zh')} ${sidebarNameIn(section, 'en')}`.toLowerCase().includes(needle);
    const entries = Object.entries(values).filter(([key]) => key !== '**ArbitraryData**' && (sectionMatch || settingSearchText(key).includes(needle)));
    if (entries.length) sidebarResults.push({ section, entries });
  }

  const cgKeys = CLICKGUI_KEYS.filter((key) => [key, t(key), I18N.zh[key], I18N.en[key]].join(' ').toLowerCase().includes(needle));
  let html = '';

  if (moduleResults.length) {
    html += `<div class="search-group-title">${esc(t('search.modules'))}</div>`;
    html += moduleResults.map(({ module, settingMatches }) => {
      const matches = settingMatches.slice(0, 12);
      const rows = matches.length
        ? matches.map((key) => `<div class="setting-row" data-open-mod="${esc(module.id)}">
            <div class="setting-main"><div class="setting-name">${esc(settingName(key))}</div><div class="setting-key">${esc(key)}</div></div>
            <span class="ms open-arrow">chevron_right</span>
          </div>`).join('')
        : `<div class="setting-row" data-open-mod="${esc(module.id)}">
            <div class="setting-main"><div class="setting-name">${esc(t('search.moduleSettings'))}</div><div class="setting-key">${esc(module.id)}</div></div>
            <span class="ms open-arrow">chevron_right</span>
          </div>`;
      const detail = settingMatches.length ? ` · ${esc(t('search.matches', settingMatches.length))}` : '';
      return `<section class="section-card open">
        <div class="section-head" data-open-mod="${esc(module.id)}">
          <div class="setting-icon"><span class="ms">${moduleIcon(module.id)}</span></div>
          <div class="section-title"><strong>${esc(moduleName(module.id))}</strong><span>${esc(module.id)}${detail}</span></div>
          <span class="ms chev open-arrow">chevron_right</span>
        </div>
        <div class="section-body">${rows}</div>
      </section>`;
    }).join('');
  }

  if (sidebarResults.length) {
    html += `<div class="search-group-title">${esc(t('search.clientSettings'))}</div>`;
    html += sidebarResults.map(({ section, entries }) => `<section class="section-card open">
      <div class="section-head">
        <div class="setting-icon"><span class="ms">${sectionIcon(section)}</span></div>
        <div class="section-title"><strong>${esc(sidebarName(section))}</strong><span>${esc(section)} · ${esc(t('search.matches', entries.length))}</span></div>
      </div>
      <div class="section-body">${entries.map(([key, value]) => renderSettingRow(key, value, `data-kind="sidebar-setting" data-section="${esc(section)}"`)).join('')}</div>
    </section>`).join('');
  }

  if (cgKeys.length) {
    html += `<div class="search-group-title">${esc(t('search.clickgui'))}</div>`;
    html += `<section class="section-card open">
      <div class="section-head" data-go-page="clickgui">
        <div class="setting-icon"><span class="ms">tune</span></div>
        <div class="section-title"><strong>${esc(t('search.clickgui'))}</strong><span>${esc(cgKeys.slice(0, 6).map((key) => t(key)).join(', '))}</span></div>
        <span class="ms chev open-arrow">chevron_right</span>
      </div>
    </section>`;
  }

  $('#searchResults').innerHTML = html || `<div class="empty">${esc(t('search.noResults'))}</div>`;
  $$('.page').forEach((item) => item.classList.toggle('active', item.id === 'page-search'));
  $('#pages').scrollTop = 0;
}

function applySearch() {
  const query = $('#search').value.trim();
  if (state.selectedModule) {
    renderModuleDetailContent(state.selectedModule, query);
    return;
  }
  renderCurrentPage();
}

function applyMod(id, key, value, type) {
  const module = state.modules.find((item) => item.id === id);
  if (module) module.settings[key] = String(value);
  send('updateModSettings', { mod: id, settings: { [key]: convertValue(value, type) } }, (reply) => {
    if (reply.failure) status(t('status.applyFailed', reply.failure.msg || 'unknown'), true);
    else status(t('status.updated', moduleName(id), settingName(key)));
  });
}

function applyModEnabled(id, enabled) {
  const module = state.modules.find((item) => item.id === id);
  if (module) module.enabled = enabled;
  send('updateModSettings', { mod: id, enabled }, (reply) => {
    if (reply.failure) status(t('status.toggleFailed', reply.failure.msg || 'unknown'), true);
    else status(enabled ? t('status.enabled', moduleName(id)) : t('status.disabled', moduleName(id)));
  });
  renderMods();
  if (state.selectedModule === id) $('#detailEnabled').checked = enabled;
}

function applySidebar(section, key, value, type) {
  send('updateSidebarSettings', { sidebar: section, settings: { [key]: convertValue(value, type) } }, (reply) => {
    if (reply.failure) status(t('status.applyFailed', reply.failure.msg || 'unknown'), true);
    else status(t('status.updated', sidebarName(section), settingName(key)));
  });
}

function enterHudEditing() {
  state.hudEditing = true;
  syncMica();
  $('#window').classList.add('hidden');
  $('#editorBar').hidden = false;
  document.body.classList.add('hud-editing');
  status(t('status.hudEditing'));
}

function exitHudEditing() {
  state.hudEditing = false;
  syncMica();
  $('#window').classList.remove('hidden');
  $('#editorBar').hidden = true;
  document.body.classList.remove('hud-editing');
  status(t('status.backToSettings'));
}

function finishUi() {
  exitHudEditing();
  send('pressButton', { selection: 'backToGame' }, (reply) => {
    if (reply.failure) status(t('status.closeFailed', reply.failure.msg || 'unknown'), true);
  });
  status(t('status.closing'));
}

let lastEscape = 0;
function escapeAction() {
  const now = performance.now();
  if (now - lastEscape < 250) return;
  lastEscape = now;
  if (state.hudEditing) {
    exitHudEditing();
    return;
  }
  if ($('#moduleDetail').classList.contains('open')) {
    closeModule();
    renderCurrentPage();
    return;
  }
  finishUi();
}
window.__featherRebornEscape = escapeAction;

function hexToRgb(hex) {
  const clean = String(hex).replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0
  };
}

function mixChannel(value, target, amount) {
  return Math.round(value + (target - value) * amount);
}

function luminance(rgb) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function applyClickGui() {
  const cg = state.clickgui;
  const rgb = hexToRgb(cg.accent);
  const alpha = (cg.accentAlpha / 100).toFixed(2);
  const primary = {
    r: mixChannel(rgb.r, 255, 0.42),
    g: mixChannel(rgb.g, 255, 0.42),
    b: mixChannel(rgb.b, 255, 0.42)
  };
  const backdrop = { r: 26, g: 29, b: 35 };
  const blended = {
    r: rgb.r * (cg.accentAlpha / 100) + backdrop.r * (1 - cg.accentAlpha / 100),
    g: rgb.g * (cg.accentAlpha / 100) + backdrop.g * (1 - cg.accentAlpha / 100),
    b: rgb.b * (cg.accentAlpha / 100) + backdrop.b * (1 - cg.accentAlpha / 100)
  };
  const onContainer = luminance(blended) > 0.55 ? '#11141a' : '#f5f8ff';
  const root = document.documentElement.style;
  root.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.setProperty('--accent-alpha', alpha);
  root.setProperty('--primary', `rgb(${primary.r}, ${primary.g}, ${primary.b})`);
  root.setProperty('--primary-container', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
  root.setProperty('--on-primary-container', onContainer);
  root.setProperty('--secondary-container', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, cg.accentAlpha / 100 * 0.72).toFixed(2)})`);
  root.setProperty('--on-secondary-container', onContainer);
  const baseAlpha = cg.windowOpacity / 100;
  const glassAlpha = cg.mica ? baseAlpha * 0.64 : baseAlpha;
  const railAlpha = cg.mica ? baseAlpha * 0.56 : baseAlpha;
  const cardAlpha = cg.mica ? baseAlpha * 0.43 : baseAlpha;
  const cardLowAlpha = cg.mica ? baseAlpha * 0.35 : baseAlpha;
  root.setProperty('--glass-alpha', glassAlpha.toFixed(2));
  root.setProperty('--rail-alpha', railAlpha.toFixed(2));
  root.setProperty('--card-alpha', cardAlpha.toFixed(2));
  root.setProperty('--card-low-alpha', cardLowAlpha.toFixed(2));
  root.setProperty('--detail-alpha', (cg.mica ? 0.82 : 1).toFixed(2));
  root.setProperty('--blur', cg.mica ? '22px' : '0px');
  root.setProperty('--radius', `${cg.radius}px`);
  root.setProperty('--ui-scale', (cg.scale / 100).toFixed(2));
  document.body.classList.toggle('no-anim', !cg.animations);
}

async function loadClickGui() {
  let saved = {};
  try {
    const response = await fetch('/api/clickgui', { cache: 'no-store' });
    if (response.ok) saved = await response.json();
  } catch (error) {
    console.error('ClickGUI config load failed', error);
  }
  if (!saved || typeof saved !== 'object' || Object.keys(saved).length === 0) {
    try {
      saved = JSON.parse(localStorage.getItem('feather-reborn-clickgui-v1') || '{}');
    } catch (error) {
      saved = {};
    }
  }
  state.clickgui = { ...DEFAULT_CLICKGUI, ...saved };
  if (!['zh', 'en'].includes(state.clickgui.language)) state.clickgui.language = 'zh';
  if (!/^#[0-9a-f]{6}$/i.test(state.clickgui.accent)) state.clickgui.accent = DEFAULT_CLICKGUI.accent;
}

function saveClickGui() {
  localStorage.setItem('feather-reborn-clickgui-v1', JSON.stringify(state.clickgui));
  fetch('/api/clickgui', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state.clickgui)
  }).catch((error) => console.error('ClickGUI config save failed', error));
}

function syncMica() {
  fetch('/api/mica', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: Boolean(state.clickgui.mica && !state.hudEditing) })
  }).catch((error) => console.error('Mica state save failed', error));
}

function applyLanguage() {
  document.documentElement.lang = state.clickgui.language === 'en' ? 'en' : 'zh-CN';
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  renderCurrentPage();
  if (state.selectedModule) openModule(state.selectedModule);
}

function setWindowOffset(x, y) {
  const limitX = Math.max(80, innerWidth / 2 - 60);
  const limitY = Math.max(60, innerHeight / 2 - 40);
  state.wx = Math.max(-limitX, Math.min(limitX, x));
  state.wy = Math.max(-limitY, Math.min(limitY, y));
  state.clickgui.windowX = state.wx;
  state.clickgui.windowY = state.wy;
  const win = $('#window');
  win.style.setProperty('--wx', `${state.wx}px`);
  win.style.setProperty('--wy', `${state.wy}px`);
}

function restoreWindowOffset() {
  if (!state.clickgui.rememberPosition) {
    setWindowOffset(0, 0);
    return;
  }
  if (Number.isFinite(state.clickgui.windowX) && Number.isFinite(state.clickgui.windowY)) {
    setWindowOffset(state.clickgui.windowX, state.clickgui.windowY);
  }
}

function bindDrag() {
  const titlebar = $('#titlebar');
  let drag = null;
  titlebar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('button, input, select, label')) return;
    drag = { px: event.clientX, py: event.clientY, wx: state.wx, wy: state.wy };
    document.body.classList.add('dragging');
    titlebar.setPointerCapture(event.pointerId);
  });
  titlebar.addEventListener('pointermove', (event) => {
    if (!drag) return;
    setWindowOffset(drag.wx + event.clientX - drag.px, drag.wy + event.clientY - drag.py);
  });
  const stop = () => {
    drag = null;
    document.body.classList.remove('dragging');
    if (state.clickgui.rememberPosition) saveClickGui();
  };
  titlebar.addEventListener('pointerup', stop);
  titlebar.addEventListener('pointercancel', stop);
  titlebar.addEventListener('dblclick', (event) => {
    if (event.target.closest('button, input, select, label')) return;
    setWindowOffset(0, 0);
  });
}

function updateClickGuiValue(key, value) {
  const out = document.querySelector(`[data-cg-value="${key}"]`);
  if (!out) return;
  out.textContent = key === 'radius' ? `${value}px` : `${value}%`;
}

document.addEventListener('input', (event) => {
  const key = event.target.dataset.cg;
  if (!key || event.target.type !== 'range') return;
  state.clickgui[key] = Number(event.target.value);
  updateClickGuiValue(key, event.target.value);
  applyClickGui();
});

document.addEventListener('change', (event) => {
  const target = event.target;
  const cgKey = target.dataset.cg;
  if (cgKey) {
    if (target.type === 'checkbox') state.clickgui[cgKey] = target.checked;
    else if (target.type === 'range') state.clickgui[cgKey] = Number(target.value);
    else state.clickgui[cgKey] = target.value;
    applyClickGui();
    saveClickGui();
    if (cgKey === 'mica') syncMica();
    if (cgKey === 'language') {
      applyLanguage();
      status(t('status.languageChanged'));
    } else if (cgKey === 'accent') {
      renderClickGui();
      status(t('status.clickguiUpdated'));
    } else {
      status(t('status.clickguiUpdated'));
    }
    return;
  }

  const kind = target.dataset.kind;
  if (!kind) return;
  const value = target.type === 'checkbox' ? target.checked : target.value;
  if (kind === 'mod-enabled') applyModEnabled(target.dataset.id, target.checked);
  else if (kind === 'mod-setting') applyMod(target.dataset.id, target.dataset.key, value, target.dataset.type);
  else if (kind === 'sidebar-setting') applySidebar(target.dataset.section, target.dataset.key, value, target.dataset.type);
});

document.addEventListener('click', (event) => {
  const preset = event.target.closest('[data-cg-accent]');
  if (preset) {
    state.clickgui.accent = preset.dataset.cgAccent;
    applyClickGui();
    saveClickGui();
    renderClickGui();
    status(t('status.clickguiUpdated'));
    return;
  }

  const action = event.target.closest('[data-cg-action]');
  if (action && action.dataset.cgAction === 'resetPosition') {
    setWindowOffset(0, 0);
    saveClickGui();
    status(t('status.positionReset'));
    return;
  }

  const tab = event.target.closest('.rail-item[data-page]');
  if (tab) {
    showPage(tab.dataset.page);
    return;
  }

  const goPage = event.target.closest('[data-go-page]');
  if (goPage) {
    showPage(goPage.dataset.goPage);
    return;
  }

  const sectionHead = event.target.closest('[data-toggle-section]');
  if (sectionHead && !event.target.closest('.setting-row')) {
    const section = sectionHead.dataset.toggleSection;
    if (state.openSections.has(section)) state.openSections.delete(section);
    else state.openSections.add(section);
    renderSidebar();
    return;
  }

  if (event.target.closest('.switch')) return;
  const card = event.target.closest('[data-open-mod]');
  if (card) openModule(card.dataset.openMod);
});

$('#detailBack').addEventListener('click', () => {
  closeModule();
  renderCurrentPage();
});
$('#detailEnabled').addEventListener('change', (event) => {
  if (state.selectedModule) applyModEnabled(state.selectedModule, event.target.checked);
});
$('#search').addEventListener('input', applySearch);
$('#editHud').addEventListener('click', enterHudEditing);
$('#finishHudEdit').addEventListener('click', exitHudEditing);
$('#closeUi').addEventListener('click', finishUi);
$('#closeUi2').addEventListener('click', finishUi);
$('#reopenUi').addEventListener('click', () => {
  $('#reopenUi').hidden = true;
  $('#window').classList.remove('hidden');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    escapeAction();
  }
});

async function refresh() {
  try {
    const [modulesResponse, sidebarResponse] = await Promise.all([
      fetch('/api/modules', { cache: 'no-store' }),
      fetch('/api/sidebar', { cache: 'no-store' })
    ]);
    if (!modulesResponse.ok || !sidebarResponse.ok) throw new Error('API error');
    state.modules = (await modulesResponse.json()).modules || [];
    state.sidebar = (await sidebarResponse.json()).sidebar || {};
    renderMods();
    renderSidebar();
    status(t('status.ready', state.modules.length));
  } catch (error) {
    console.error(error);
    status(t('status.loadFailed'), true);
  }
}

async function boot() {
  await loadClickGui();
  applyClickGui();
  syncMica();
  applyLanguage();
  restoreWindowOffset();
  bindDrag();
  initBridge();
  status(t('status.loading'));
  refresh();
}

boot();
