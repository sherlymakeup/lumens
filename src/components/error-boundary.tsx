import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Menangkap JS error yang tidak tertangani agar tidak jadi blank/hang.
 *  Tampilkan fallback dengan tombol refresh, bukan layar kosong. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
          <p className="text-lg font-semibold">Terjadi kesalahan</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Aplikasi mengalami error. Coba refresh halaman.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Refresh halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
