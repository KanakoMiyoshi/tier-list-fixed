export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>tier-list-fixed</h1>
      <pre>
        {JSON.stringify(
          {
            hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          },
          null,
          2
        )}
      </pre>
    </main>
  );
}
