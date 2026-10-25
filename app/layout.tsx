import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Beyond فواتير | مساحة أوضح لحساباتك',description:'استخراج ملخص الفواتير بالذكاء الاصطناعي، مراجعة جماعية، وتصدير منظم بهوية Beyond.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="ar" dir="rtl"><head><meta name="theme-color" content="#2458e6"/></head><body>{children}</body></html>;
}
