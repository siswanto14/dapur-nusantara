<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        @include('partials.head')
    </head>
    <body class="min-h-screen bg-stone-50 text-stone-800 antialiased dark:bg-stone-950 dark:text-stone-100">
        <main class="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
            <x-app-logo-icon class="size-12 fill-current text-amber-700 dark:text-amber-400" />
            <div>
                <h1 class="text-2xl font-semibold">{{ config('app.name') }}</h1>
                <p class="mt-2 text-stone-600 dark:text-stone-400">Sistem manajemen pemesanan catering.</p>
            </div>
            <div class="flex gap-3">
                @auth
                    <a href="{{ route('dashboard') }}" class="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">Buka dashboard</a>
                @else
                    <a href="{{ route('login') }}" class="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">Masuk</a>
                    @if (Route::has('register'))
                        <a href="{{ route('register') }}" class="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-900">Daftar</a>
                    @endif
                @endauth
            </div>
        </main>
    </body>
</html>
