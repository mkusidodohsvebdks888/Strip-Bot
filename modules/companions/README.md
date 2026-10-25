# 桌宠与 QQ 机器人

每个子目录独立维护职责和模块入口；旧 backend 导入位置为兼容转发文件。

- **astrbot**：AstrBot/NapCat 状态及本地联动（`modules/companions/astrbot/index.cjs`）。
- **nono**：3D 桌宠进程及本地聊天接入（`modules/companions/nono/index.cjs`）。

依赖与入口详见各模块 module.json 和 ../catalog.json。
