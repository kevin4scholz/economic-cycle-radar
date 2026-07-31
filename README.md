# رادار چرخه اقتصاد

داشبورد فارسی و توضیح‌پذیر برای پایش سیگنال چرخه‌ی اقتصاد آمریکا. نسخه‌ی MVP از سری `T10Y2Y` برای امتیاز قاعده‌محور و از `USREC` برای نمایش دوره‌های تاریخی رکود استفاده می‌کند.

> این پروژه ابزار آموزشی و تصمیم‌یار است. امتیاز آن احتمال قطعی رکود، توصیه‌ی سرمایه‌گذاری یا دستور معامله نیست.

## وضعیت نسخه‌ی MVP

- افق تحلیل: ۱۲ ماه
- مدل: `mvp-rule-v1`
- منبع: FRED / Federal Reserve Bank of St. Louis
- رابط: فارسی، RTL و واکنش‌گرا
- خروجی عمومی: `dashboard/public/data/dashboard-data.json`

## اجرای محلی با داده‌ی نمونه

پیش‌نیازها در `pyproject.toml` و `dashboard/package.json` ثبت شده‌اند. پس از نصب وابستگی‌ها:

```powershell
python -m economic_cycle_radar.cli `
  --fixtures tests/fixtures `
  --as-of 2021-01-20 `
  --output dashboard/public/data/dashboard-data.json

cd dashboard
pnpm dev
```

داده‌ی نمونه فقط برای توسعه و آزمون است و در خروجی با `data_mode: fixture` مشخص می‌شود.

## اجرای زنده

1. فایل `.env.example` را به `.env` کپی کنید.
2. مقدار `FRED_API_KEY` را شخصاً وارد کنید؛ آن را در گفتگو یا commit قرار ندهید.
3. متغیر محیطی را در ترمینال بارگذاری و اجرا کنید:

```powershell
python -m economic_cycle_radar.cli `
  --output dashboard/public/data/dashboard-data.json `
  --raw-dir data/raw
```

اگر کلید موجود نباشد یا دریافت داده شکست بخورد، فرمان با خطا متوقف می‌شود و فایل خروجی قبلی را بازنویسی نمی‌کند.

## آزمون و ساخت

```powershell
pytest
ruff check .
cd dashboard
pnpm test --run
pnpm build
```

روش محاسبه و محدودیت‌ها در [docs/methodology.md](docs/methodology.md) آمده است.

## انتشار

Workflowهای GitHub Actions آماده‌اند، اما انتشار عمومی به‌طور پیش‌فرض خاموش است. پس از عمومی‌شدن مخزن و تأیید مهرشاد، Repository Variable با نام `ENABLE_PAGES` روی `true` تنظیم و GitHub Pages روی Actions فعال می‌شود. کلید FRED فقط در Secret با نام `FRED_API_KEY` قرار می‌گیرد.

