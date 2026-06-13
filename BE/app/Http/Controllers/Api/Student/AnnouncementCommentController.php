<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\ClassAnnouncement;
use App\Models\ClassAnnouncementComment;
use App\Models\StudentProfile;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

class AnnouncementCommentController extends Controller
{
    public function index(Request $request, ClassAnnouncement $announcement)
    {
        $studentId = $request->user()->id;
        $profile = StudentProfile::query()->where('user_id', $studentId)->firstOrFail();

        if ((int) $announcement->class_id !== (int) $profile->class_id || ! $announcement->isPublished()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $comments = ClassAnnouncementComment::query()
            ->with(['student'])
            ->where('announcement_id', $announcement->id)
            ->where('status', ClassAnnouncementComment::STATUS_VISIBLE)
            ->orderBy('id')
            ->paginate(30);

        return response()->json(['data' => $comments]);
    }

    public function store(Request $request, ClassAnnouncement $announcement)
    {
        $studentId = $request->user()->id;
        $profile = StudentProfile::query()->where('user_id', $studentId)->firstOrFail();

        if ((int) $announcement->class_id !== (int) $profile->class_id || ! $announcement->isPublished()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $comment = ClassAnnouncementComment::create([
            'announcement_id' => $announcement->id,
            'student_id' => $studentId,
            'body' => $data['body'],
            'status' => ClassAnnouncementComment::STATUS_VISIBLE,
        ]);

        AuditLogger::log($request->user(), 'announcement_comment.create', $comment, 'Created announcement comment');

        return response()->json(['data' => $comment->load('student')], 201);
    }

    public function update(Request $request, ClassAnnouncementComment $comment)
    {
        $studentId = $request->user()->id;

        if ((int) $comment->student_id !== (int) $studentId) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $comment->body = $data['body'];
        $comment->save();

        AuditLogger::log($request->user(), 'announcement_comment.update', $comment, 'Updated announcement comment');

        return response()->json(['data' => $comment]);
    }

    public function destroy(Request $request, ClassAnnouncementComment $comment)
    {
        $studentId = $request->user()->id;

        if ((int) $comment->student_id !== (int) $studentId) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $id = $comment->id;
        $comment->delete();

        AuditLogger::log($request->user(), 'announcement_comment.delete', null, "Deleted announcement comment {$id}");

        return response()->json(['ok' => true]);
    }
}

