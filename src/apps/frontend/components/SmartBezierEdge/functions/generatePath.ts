// FIXME: The "pathfinding" module doe not have proper typings.
/* eslint-disable
	@typescript-eslint/no-unsafe-call,
	@typescript-eslint/no-unsafe-member-access,
	@typescript-eslint/no-unsafe-assignment,
	@typescript-eslint/ban-ts-comment,
*/
import type { XYPosition } from '@xyflow/react';
import type { Grid } from 'pathfinding';
import { AStarFinder, DiagonalMovement, JumpPointFinder, Util } from 'pathfinding';

function interpolate(x0: number, y0: number, x1: number, y1: number) {
    var abs = Math.abs,
        line = [],
        sx,
        sy,
        dx,
        dy,
        err,
        e2;

    dx = abs(x1 - x0);
    dy = abs(y1 - y0);

    sx = x0 < x1 ? 1 : -1;
    sy = y0 < y1 ? 1 : -1;

    err = dx - dy;

    while (true) {
        line.push([x0, y0]);

        if (x0 === x1 && y0 === y1) {
            break;
        }

        e2 = 2 * err;
        if (e2 > -dy) {
            err = err - dy;
            x0 = x0 + sx;
        }
        if (e2 < dx) {
            err = err + dx;
            y0 = y0 + sy;
        }
    }

    return line;
}

function smoothenPath(grid: Grid, path: number[][]) {
    var len = path.length,
        x0 = path[0][0], // path start x
        y0 = path[0][1], // path start y
        x1 = path[len - 1][0], // path end x
        y1 = path[len - 1][1], // path end y
        sx,
        sy, // current start coordinate
        ex,
        ey, // current end coordinate
        newPath,
        i,
        j,
        coord,
        line,
        testCoord,
        blocked,
        lastValidCoord;

    sx = x0;
    sy = y0;
    newPath = [[sx, sy]];

    for (i = 2; i < len; ++i) {
        coord = path[i];
        ex = coord[0];
        ey = coord[1];
        line = interpolate(sx, sy, ex, ey);

        blocked = false;
        for (j = 1; j < line.length; ++j) {
            testCoord = line[j];

            if (!grid.isWalkableAt(testCoord[0], testCoord[1])) {
                blocked = true;
                break;
            }
        }
        if (blocked) {
            lastValidCoord = path[i - 1];
            newPath.push(lastValidCoord);
            sx = lastValidCoord[0];
            sy = lastValidCoord[1];
        }
    }
    newPath.push([x1, y1]);

    return newPath;
}

/**
 * Takes source and target {x, y} points, together with an grid representation
 * of the graph, and returns two arrays of number tuples [x, y]. The first
 * array represents the full path from source to target, and the second array
 * represents a condensed path from source to target.
 */
export type PathFindingFunction = (
    grid: Grid,
    start: XYPosition,
    end: XYPosition
) => {
    fullPath: number[][];
    smoothedPath: number[][];
} | null;

export const pathfindingAStarDiagonal: PathFindingFunction = (grid, start, end) => {
    try {
        const finder = new AStarFinder({
            diagonalMovement: DiagonalMovement.Always
        });
        const fullPath = finder.findPath(start.x, start.y, end.x, end.y, grid);
        const smoothedPath = smoothenPath(grid, fullPath);
        if (fullPath.length === 0 || smoothedPath.length === 0) return null;
        return { fullPath, smoothedPath };
    } catch (e) {
        console.error(e);
        return null;
    }
};

export const pathfindingAStarNoDiagonal: PathFindingFunction = (grid, start, end) => {
    try {
        const finder = new AStarFinder({
            diagonalMovement: DiagonalMovement.Never
        });
        const fullPath = finder.findPath(start.x, start.y, end.x, end.y, grid);
        const smoothedPath = Util.smoothenPath(grid, fullPath);
        if (fullPath.length === 0 || smoothedPath.length === 0) return null;
        return { fullPath, smoothedPath };
    } catch {
        return null;
    }
};

export const pathfindingJumpPointNoDiagonal: PathFindingFunction = (grid, start, end) => {
    try {
        // FIXME: The "pathfinding" module doe not have proper typings.
        // @ts-ignore
        const finder = new JumpPointFinder({
            diagonalMovement: DiagonalMovement.Never
        });
        const fullPath = finder.findPath(start.x, start.y, end.x, end.y, grid);
        const smoothedPath = fullPath;
        if (fullPath.length === 0 || smoothedPath.length === 0) return null;
        return { fullPath, smoothedPath };
    } catch {
        return null;
    }
};
