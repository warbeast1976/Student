<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassAnnouncementComment;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

class AnnouncementCommentController extends Controller
{
    public function index(Request $request)
    {
        $query = ClassAnnouncementComment::query()
            ->with(['announcement.schoolClass', 'student', 'moderator'])
            ->orderByDesc('id');

        if ($request->filled('announcement_id')) {
            $query->where('announcement_id', $request->integer('announcement_id'));
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->integer('student_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json(['data' => $query->paginate(30)]);
    }

    public function destroy(Request $request, ClassAnnouncementComment $comment)
    {
        $id = $comment->id;
        $comment->delete();

        AuditLogger::log($request->user(), 'announcement_comment.delete', null, "Deleted announcement comment {$id} (admin)");

        return response()->json(['ok' => true]);
    }
}

