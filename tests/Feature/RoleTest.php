<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class RoleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['web', 'auth', 'role:admin'])
            ->get('/_test/admin-only', fn () => 'ok');
    }

    public function test_pengguna_baru_berperan_staf_secara_default(): void
    {
        $this->assertSame(UserRole::Staff, User::factory()->create()->fresh()->role);
    }

    public function test_seeder_membuat_akun_admin(): void
    {
        $this->seed(DatabaseSeeder::class);

        $admin = User::where('email', 'admin@dapurnusantara.test')->first();

        $this->assertNotNull($admin);
        $this->assertTrue($admin->isAdmin());
    }

    public function test_admin_bisa_membuka_rute_khusus_admin(): void
    {
        $this->actingAs(User::factory()->admin()->create())
            ->get('/_test/admin-only')
            ->assertOk();
    }

    public function test_staf_ditolak_dari_rute_khusus_admin(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/_test/admin-only')
            ->assertForbidden();
    }
}
