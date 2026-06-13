<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('qr_public_token', 64)->nullable()->unique()->after('student_number');
        });

        $rows = DB::table('student_profiles')->whereNull('qr_public_token')->orWhere('qr_public_token', '')->get(['id']);
        foreach ($rows as $row) {
            DB::table('student_profiles')->where('id', $row->id)->update([
                'qr_public_token' => Str::random(48),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn('qr_public_token');
        });
    }
};
