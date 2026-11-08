# Receiving, storing, and sending files with Django

**Django sits between the client and your server's filesystem.** The client sends or requests file contents over HTTPS; Django reads and writes the files on the Ubuntu machine.

## Receiving files from the client

1. The user selects an image or PDF using the website's or mobile app's file picker.
2. The app sends the file's bytes to a Django endpoint, usually as `multipart/form-data`.
3. Django receives the uploaded file through `request.FILES`.
4. Your backend chooses a filename and saves it into a directory on the Ubuntu server.
5. Django returns a response confirming the upload.

```text
Client file picker
    -> HTTPS upload
    -> Django
    -> File saved on Ubuntu disk
```

The client sends the actual contents, not just a path such as `Pictures/screenshot.png`. Django does not need direct access to the customer's filesystem.

## Storing files on the server

Django's **`FileSystemStorage`** handles saving and opening files. For example, these are the core operations inside an upload handler, rather than a complete endpoint:

```python
from uuid import uuid4
from django.core.files.storage import FileSystemStorage

storage = FileSystemStorage(location="/srv/inventory-manager/private-files")

uploaded_file = request.FILES["file"]
stored_name = storage.save(uuid4().hex, uploaded_file)
```

This saves the uploaded contents under a generated name. The file remains on disk after the request finishes and after Django restarts. The directory must exist or be creatable, and the Django process needs permission to write there. See [Django file storage](https://docs.djangoproject.com/en/5.2/topics/files/).

Django may temporarily hold a small upload in memory or place a larger one in a temporary file before you save it to its final location. That buffering is handled by Django's upload system. See [Django uploads](https://docs.djangoproject.com/en/stable/topics/http/file-uploads/).

## Sending stored files to the client

1. The client requests an endpoint such as `GET /api/files/<file-id>/`.
2. Django checks access and resolves which stored file to open.
3. Django reads the file and returns its contents in the HTTP response.
4. The client displays it or saves it locally.

```text
Client requests file
    -> Django opens file on Ubuntu
    -> HTTPS response containing file bytes
    -> Client displays or downloads it
```

Django provides **`FileResponse`** for returning file contents:

```python
from django.http import FileResponse

response = FileResponse(
    storage.open(stored_name, "rb"),
    as_attachment=True,
    filename="invoice.pdf",
)
```

Here, `stored_name` is resolved by the server. `filename="invoice.pdf"` gives the client a friendly download name; it does not rename the stored file.

With `as_attachment=True`, browsers generally treat the response as a download. For displaying an image inside a page, the response can be served inline with the correct content type. A mobile app decides whether to show the received bytes or save them to its own storage. See [Django file responses](https://docs.djangoproject.com/en/5.2/ref/request-response/#fileresponse-objects).

## Additional suggestions for later

- **Compression:** use Pillow to resize and compress images before saving, while keeping screenshot text readable.
- **Thumbnails:** serve smaller copies in chat previews.
- **Validation and limits:** check file contents and enforce upload-size limits.
- **Backups:** back up the server's storage directory.
