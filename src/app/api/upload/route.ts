import { NextRequest, NextResponse } from 'next/server';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json(
        { error: { message: 'No file provided' } },
        { status: 400 }
      );
    }

    // Convert file to arrayBuffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Handle different file types
    let text = '';
    if (file.type === 'application/pdf') {
      const loader = new PDFLoader(new Blob([buffer]));
      const docs = await loader.load();
      text = docs.map(doc => doc.pageContent).join('\n');
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const loader = new DocxLoader(new Blob([buffer]));
      const docs = await loader.load();
      text = docs.map(doc => doc.pageContent).join('\n');
    } else {
      return NextResponse.json(
        { error: { message: 'Unsupported file type' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ content: text });
  } catch {
    return NextResponse.json(
      { error: { message: 'Failed to process file' } },
      { status: 500 }
    );
  }
}