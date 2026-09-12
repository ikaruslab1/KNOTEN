import { NavBar } from '@/components/ui/NavBar'

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main className="pt-14 min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </>
  )
}
