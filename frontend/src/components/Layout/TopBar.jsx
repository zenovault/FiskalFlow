/**
 * Top bar showing current page title.
 */

export default function TopBar({ title }) {
  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-6">
      <h2 className="text-gray-900 dark:text-white font-semibold text-base">{title}</h2>
    </header>
  )
}
