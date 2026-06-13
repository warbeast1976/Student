<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_password_setup_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');
            $table->string('token_hash', 64)->unique();
            $table->string('status')->default('pending');
            $table->timestamp('expires_at');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['email']);
            $table->index(['status']);
            $table->index(['expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_password_setup_invites');
    }
};

