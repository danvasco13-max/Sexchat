import './styles.css';
export const metadata = { title: 'Sexchat — plataforma 18+', description: 'Base inicial da plataforma Sexchat.' };
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="pt-BR"><body>{children}</body></html>;
}