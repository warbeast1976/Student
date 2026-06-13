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
        Schema::create('absence_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_record_id')->unique()->constrained('attendance_records')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('admin_remarks')->nullable();
            $table->timestamps();

            $table->index(['student_id']);
            $table->index(['class_id']);
            $table->index(['status']);
            $table->index(['submitted_by']);
            $table->index(['reviewed_by']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absence_reports');
    }
};
