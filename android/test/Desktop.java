import app.facereveal.swap.Engine;
import app.facereveal.swap.Img;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;

/** Desktop check of the swap engine: java Desktop <models> <emap.bin> <smiley.jpg> <face.jpg> <cx> <cy> <r> <out.png> [faceRatio reach tone enhance] */
public class Desktop {
    static Img load(String path) throws Exception {
        BufferedImage bi = ImageIO.read(new File(path));
        int[] argb = bi.getRGB(0, 0, bi.getWidth(), bi.getHeight(), null, 0, bi.getWidth());
        return Img.fromArgb(argb, bi.getWidth(), bi.getHeight());
    }

    public static void main(String[] a) throws Exception {
        Engine e = new Engine(new File(a[0]), new FileInputStream(a[1]));
        Img smiley = load(a[2]), face = load(a[3]);
        Engine.Params p = new Engine.Params();
        if (a.length > 8) p.faceRatio = Double.parseDouble(a[8]);
        if (a.length > 9) p.reach = Double.parseDouble(a[9]);
        if (a.length > 10) p.tone = Double.parseDouble(a[10]);
        if (a.length > 11) p.enhance = Boolean.parseBoolean(a[11]);
        if (a.length > 12) p.roll = Double.parseDouble(a[12]);
        if (a.length > 13) p.mirror = Boolean.parseBoolean(a[13]);
        java.util.List<Img> extras = new java.util.ArrayList<Img>();
        for (int i = 14; i < a.length; i++) extras.add(load(a[i]));
        long t = System.currentTimeMillis();
        Img out = e.swap(smiley, Double.parseDouble(a[4]), Double.parseDouble(a[5]), Double.parseDouble(a[6]), face, extras, p,
                m -> System.out.println("  " + m + " (" + (System.currentTimeMillis() - t) + " ms)"));
        BufferedImage bo = new BufferedImage(out.w, out.h, BufferedImage.TYPE_INT_RGB);
        bo.setRGB(0, 0, out.w, out.h, out.toArgb(), 0, out.w);
        ImageIO.write(bo, "png", new File(a[7]));
        System.out.println("done in " + (System.currentTimeMillis() - t) + " ms -> " + a[7]);
    }
}
