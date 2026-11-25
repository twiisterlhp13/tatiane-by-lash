import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-6xl text-berry">404</p>
      <h1 className="mt-2 font-display text-2xl">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted">Confira o link que você recebeu. Se o endereço mudou, peça o novo link ao estabelecimento.</p>
      <Link href="/" className="mt-6 rounded-full bg-berry px-6 py-3 font-medium text-white">Ir para o início</Link>
    </main>
  );
}
