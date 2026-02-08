export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="text-4xl font-bold mb-4">¡Estás Sin Conexión!</h1>
      <p className="text-lg text-center mb-8">
        No pudimos conectar con la red. Algunas funcionalidades pueden estar limitadas.
        <br />
        Pero no te preocupes, puedes seguir trabajando con la última información disponible.
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Cuando recuperes la conexión, tus cambios se sincronizarán automáticamente.
      </p>
    </div>
  );
}