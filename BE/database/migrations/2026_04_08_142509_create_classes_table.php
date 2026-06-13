<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('class_name');
            $table->string('grade_level');
            $table->string('section');
            $table->text('description')->nullable();
            $table->timestamps();

            $table->unique(['school_year_id', 'class_name'], 'classes_school_year_class_name_unique');
            $table->index(['teacher_id']);
            $table->index(['grade_level', 'section']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('classes');
    }
};
