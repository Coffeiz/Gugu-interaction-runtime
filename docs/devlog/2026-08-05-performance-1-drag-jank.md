# 拖拽跨列与落地卡顿排查

## 现象

看板卡片拖拽整体不流畅：移动速度时快时慢；跨列时明显掉帧；松手落地瞬间（尤其落进分组多、卡片多的“已完成”列）有肉眼可见的顿挫。

## 排查

没有靠猜，每一处都是先录 Chrome Performance trace，再对着调用栈定位到具体函数，逐个击破：

1. 拖拽本身的“时快时慢”：trace 显示命中判定（`RegisteredHit.ts`）在一次 pointermove 里被反复触发 `getBoundingClientRect`，DevTools 报了“强制自动重排”警告。
2. 跨列掉帧：同一份警告的调用栈指向 `CardMotionController` 的 `onFrame` 每帧直接写 `floatingProxy.style.left/top`。
3. 落地卡顿（313ms 阻塞）：trace 里单个函数调用 `captureLayoutFlip` 就占了 118ms。
4. 同一份 trace 继续深挖，发现 `[data-layout-surface]` 这个选择器在一次 `captureLayoutFlip` 里被 `querySelectorAll` 了两遍。
5. 20 倍降速测试后录的 trace，`Paint` 事件的 `clip` 全是整个视口大小（`[0,0,1357,1071]`），不是代理卡片那一小块。

## 根因

五个问题，五个不同的根因，但都是同一类“做了比实际需要更多的工作”：

- `RegisteredHit.ts` 的 `findSurface`/`findIndex` 用 `.sort()` 比较器现测 `getBoundingClientRect`，比较器会被调用 O(n log n) 次，同一个元素在一次命中判定里被反复强制布局。
- `CardMotionController` 的 `onFrame` 用 `left`/`top`（触发布局的属性）做每帧位置动画，而不是纯合成层的 `transform`——写完 `left`/`top` 后紧跟着的命中判定要读 `getBoundingClientRect`，逼着浏览器把脏布局同步刷新掉。
- “已完成”列按年/月分组，折叠只是收起高度、卡片节点仍然挂在 DOM 里；`captureLayoutFlip` 的参与者收集不区分展开/折叠，一律纳入测量。
- `captureLayoutFlip` 里 `activeSurfaces` 和 `surfaces` 各自单独查了一遍 `[data-layout-surface]`，这个选择器要扫全文档，重复查询等于白付一倍成本。
- 拖拽代理没有 `will-change: transform`，浏览器没有把它单独提到合成层，每次 transform 变化连带整个视口一起重新栅格化。

## 修复

- `RegisteredHit.ts`：先把候选元素的 rect 一次性测好缓存下来，过滤/排序/遍历都只读缓存。
- `CardMotionController` 的 onFrame：`left`/`top` 只在代理创建时定死一次，之后每帧只写 `transform` 的 `translate3d` 叠加位移量。
- `DetachAdapter.ts` 的 `registeredElements()`：用 `closest('[data-layout-content][data-layout-open="false"]')` 排除被折叠祖先包住的卡片，不参与本次 FLIP。
- `captureLayoutFlip`：合并两次重复的 `[data-layout-surface]` 查询为一次，两处复用同一份结果。
- `createDragProxy`：加 `will-change: transform`，grabbing 浮动本体和 landing 落地代理都走这一个创建入口，一次改动同时覆盖两种代理。

## 教训

“看起来是同一个卡顿”背后可能是好几个互不相关的根因——这次五个问题分散在命中判定、动画写法、FLIP 范围、DOM 查询、合成层策略五个不同的层面，如果只凭猜测挑一个改，大概率只能解决其中一小部分，还会误判“修复没什么效果”。每一步先用 Performance trace 的调用栈把嫌疑锁定到具体函数和具体行号，再动手，比连续试错快得多，也更容易在改完之后用同一份 trace 验证有没有真的解决。
