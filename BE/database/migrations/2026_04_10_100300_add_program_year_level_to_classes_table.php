<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->foreignId('program_id')->nullable()->after('school_year_id')->constrained('programs')->nullOnDelete();
            $table->unsignedTinyInteger('year_level')->nullable()->after('program_id');
        });
    }

    public function down(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('program_id');
            $table->dropColumn('year_level');
        });
    }
};
