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
        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('student_number')->unique();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->date('birth_date')->nullable();
            $table->string('contact_number')->nullable();
            $table->string('guardian_name')->nullable();
            $table->string('guardian_contact_number')->nullable();
            $table->text('address')->nullable();
            $table->timestamps();

            $table->index(['student_number']);
            $table->index(['class_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_profiles');
    }
};
