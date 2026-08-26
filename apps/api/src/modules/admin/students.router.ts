import { Router } from 'express';
import { studentsService } from './students.service';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import busboy from 'busboy';
import { parse } from 'csv-parse';
import { BadRequestError } from '../../lib/errors';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';

export const adminStudentsRouter: Router = Router();

adminStudentsRouter.use(authenticate, requireRole(['PLATFORM_ADMIN']));

adminStudentsRouter.get(
  '/',
  validate(
    z.object({
      query: z.object({
        q: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).default(50),
        status: z.enum(['ACTIVE', 'REVOKED']).optional(),
      })
    })
  ),
  async (req, res, next) => {
    try {
      const result = await studentsService.listStudents(req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

adminStudentsRouter.post(
  '/',
  validate(
    z.object({
      body: z.object({
        email: z.string().email(),
      })
    })
  ),
  async (req, res, next) => {
    try {
      // req.user is guaranteed by requireAuth
      const result = await studentsService.addStudent(req.user!.id, req.body.email);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

adminStudentsRouter.post(
  '/import',
  (req, res, next) => {
    const bb = busboy({ headers: req.headers, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit
    const emails: string[] = [];
    let fileFound = false;
    let rowCount = 0;
    const MAX_ROWS = 5000;
    let parserError: Error | null = null;
    let parserDone = Promise.resolve();

    bb.on('file', (name: string, file: any, info: any) => {
      if (name !== 'file') {
        file.resume();
        return;
      }
      fileFound = true;
      const parser = parse({ columns: true, skip_empty_lines: true, bom: true, trim: true, record_delimiter: ['\r\n', '\n', '\r'] });

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          rowCount++;
          if (rowCount > MAX_ROWS) {
            parser.destroy(new BadRequestError(`Maximum row limit of ${MAX_ROWS} exceeded`));
            return;
          }
          const email = record.email || record.Email || record.EMAIL;
          if (email) {
            emails.push(email);
          }
        }
      });

      parser.on('error', (err: any) => {
        parserError = err;
      });

      parserDone = new Promise((resolve) => {
        parser.on('end', () => resolve(undefined));
        parser.on('error', () => resolve(undefined)); // handled via parserError
      });
      
      file.on('limit', () => {
        parser.destroy(new BadRequestError('File size limit of 2MB exceeded'));
      });

      file.pipe(parser);
    });

    bb.on('finish', async () => {
      await parserDone;

      if (!fileFound) {
        return next(new BadRequestError('No file uploaded'));
      }
      if (parserError) {
        return next(new BadRequestError(`Malformed CSV: ${parserError.message}`));
      }
      if (emails.length === 0) {
        return next(new BadRequestError('No valid email column found in CSV'));
      }

      try {
        const result = await studentsService.importStudentsCsv(req.user!.id, emails);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    });

    req.pipe(bb);
  }
);

adminStudentsRouter.delete(
  '/:id',
  async (req, res, next) => {
    try {
      await studentsService.removeStudent(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
