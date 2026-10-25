# 通用基础层

每个子目录独立维护职责和模块入口；旧 backend 导入位置为兼容转发文件。

- **providers**：共享模型协议、网络安全校验及错误抽象（`modules/core/providers/index.cjs`）。

依赖与入口详见各模块 module.json 和 ../catalog.json。
