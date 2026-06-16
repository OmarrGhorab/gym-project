<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Password reset landing route used by Laravel's ResetPassword notification.
// It redirects to the frontend reset-password page with the token and email.
Route::get('/reset-password', function (Request $request) {
    $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');

    return redirect()->away(
        $frontendUrl.'/auth/reset-password?'.http_build_query([
            'token' => $request->query('token'),
            'email' => $request->query('email'),
        ])
    );
})->name('password.reset');
