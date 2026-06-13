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
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnUpdate()->restrictOnDelete();
            $table->date('attendance_date');
            $table->enum('status', ['present', 'absent', 'late', 'excused'])->default('present');
            $table->text('remarks')->nullable();
            $table->timestamps();
        
            $table->unique(['student_id', 'class_id', 'attendance_date'], 'attendance_unique_per_student_class_date');
            $table->index(['attendance_date']);
            $table->index(['status']);
            $table->index(['class_id', 'attendance_date']);
            $table->index(['student_id', 'attendance_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
    }
};
