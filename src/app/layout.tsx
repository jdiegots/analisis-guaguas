import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Análisis Guaguas Municipales - Las Palmas de GC',
  description: 'Análisis de transporte público basado en datos GTFS y secciones censales',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
