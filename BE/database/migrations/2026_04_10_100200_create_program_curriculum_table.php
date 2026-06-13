<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('program_curriculum', function (Blueprint $table) {
            $table->id();
            $table->foreignId('program_id')->constrained('programs')->cascadeOnDelete();
            $table->unsignedTinyInteger('year_level');
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['program_id', 'year_level', 'subject_id'], 'program_year_subject_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_curriculum');
    }
};
