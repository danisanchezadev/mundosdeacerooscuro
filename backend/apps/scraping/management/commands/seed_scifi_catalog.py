from django.core.management.base import BaseCommand, CommandError

from apps.scraping.clients import OpenLibraryClient, WikipediaClient
from apps.scraping.importer import CatalogImporter


class Command(BaseCommand):
    help = "Importa un catálogo inicial de libros de ciencia ficción desde OpenLibrary y Wikipedia."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100, help="Número de libros a importar (por defecto 100).")
        parser.add_argument("--no-wikipedia", action="store_true", help="No consultar Wikipedia (sinopsis/biografías).")
        parser.add_argument(
            "--wiki-langs", default="es,en", help="Idiomas de Wikipedia por orden de preferencia (por defecto es,en)."
        )
        parser.add_argument(
            "--discover", action="store_true",
            help="Si --limit supera la lista curada, completar con libros del tema 'science_fiction' de OpenLibrary.",
        )
        parser.add_argument("--delay", type=float, default=0.2, help="Pausa entre peticiones HTTP, en segundos.")

    def _log(self, message):
        # Legacy consoles (e.g. cp1252 on Windows) cannot encode every character in titles/authors.
        encoding = getattr(self.stdout._out, "encoding", None) or "utf-8"
        self.stdout.write(message.encode(encoding, errors="replace").decode(encoding))

    def handle(self, *args, **options):
        if options["limit"] < 1:
            raise CommandError("--limit debe ser mayor que 0.")
        delay = options["delay"]
        wikipedia = None
        if not options["no_wikipedia"]:
            languages = tuple(lang.strip() for lang in options["wiki_langs"].split(",") if lang.strip())
            wikipedia = WikipediaClient(languages=languages, delay=delay)

        importer = CatalogImporter(OpenLibraryClient(delay=delay), wikipedia, log=self._log)
        stats = importer.run(limit=options["limit"], discover=options["discover"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Catálogo importado: {stats.created} creados, {stats.updated} actualizados, {stats.failed} con error."
            )
        )
        for error in stats.errors:
            self.stderr.write(self.style.WARNING(error))
