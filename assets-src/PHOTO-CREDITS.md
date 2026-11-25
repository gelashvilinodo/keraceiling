# დროებითი ფოტოები (placeholder)

ფოტოები Unsplash-იდან (**Unsplash License**) და Pexels-იდანაა (**Pexels License**) — უფასოა კომერციული გამოყენებისთვის, ავტორის მითითება სავალდებულო არ არის.
გამონაკლისი: „ვარსკვლავიანი ცა“ Wikimedia Commons-იდანაა, **CC BY-SA 4.0** — ავტორი და ლიცენზია საიტის footer-შია მითითებული; ფოტოს ჩანაცვლებისას ის ხაზიც წაშალე.
ჩანაცვლდება დამკვეთის რეალური ობიექტების ფოტოებით.

| სექცია | ფაილი (public/images/…) | ავტორი | წყარო |
|---|---|---|---|
| ადრე და შემდეგ — „შემდეგ“ | before-after/after-*.jpg | jason hu | https://unsplash.com/photos/-FnBmMfAicg |
| განათება | lighting/lighting-*.jpg | S.Group Official | https://unsplash.com/photos/6spmqj2OSLk |
| ნამუშევრები — მისაღები | portfolio/living-*.jpg | Prydumano Design | https://unsplash.com/photos/4Q9aOJF-6vI |
| ნამუშევრები — საძინებელი | portfolio/bedroom-*.jpg | Franco Debartolo | https://unsplash.com/photos/FuP0NGyMVIU |
| ნამუშევრები — სამზარეულო | portfolio/kitchen-*.jpg | Jason Briscoe | https://unsplash.com/photos/AQl-J19ocWE |
| ნამუშევრები — აბაზანა | portfolio/bath-*.jpg | Bilal Mansuri | https://unsplash.com/photos/cxpB9IPVjDM |
| ნამუშევრები — ოფისი | portfolio/office-*.jpg | Caroline Badran | https://unsplash.com/photos/xTmez98cqAM |
| ნამუშევრები — სტუდიო | portfolio/studio-*.jpg | Prydumano Design | https://unsplash.com/photos/RkxYNDmCUrQ |
| ტიპები — მატი | types/matte-*.jpg | Pexels | https://www.pexels.com/photo/3615726/ |
| ტიპები — პრიალა | types/glossy-*.jpg | Pexels | https://www.pexels.com/photo/7546321/ |
| ტიპები — სატინი | types/satin-*.jpg | Paulo Rodrigues | https://unsplash.com/photos/NYq4qh9GEwQ |
| ტიპები — ფოტობეჭდვით | types/print-*.jpg | Dylan Ferreira | https://unsplash.com/photos/Ye8mxE9Vdcs |
| ტიპები — ვარსკვლავიანი ცა | types/stars-*.jpg | Дом Неба — **CC BY-SA 4.0**, ატრიბუცია სავალდებულოა (footer-შია) | https://commons.wikimedia.org/wiki/File:Ceiling_starry_sky.jpg |
| ტიპები — ფერადი | types/colored-*.jpg | Pexels | https://www.pexels.com/photo/7173662/ |
| ტიპები — მეტალიკი / სადაფისებრი | types/metallic-*.jpg | Pexels | https://www.pexels.com/photo/13025279/ |

„ადრე“ ფოტო (before-after/before-*.jpg) — მომხმარებლის მიერ მოწოდებული ფაილი.

## როგორ ჩავანაცვლო რეალური ფოტოთი

- **ნამუშევრები:** ჩადე ახალი ფოტო `public/images/portfolio/`-ში ორ ზომაში — `NAME-480.jpg` (480×600) და `NAME-960.jpg` (960×1200), 4:5 პროპორციით; შემდეგ `src/data/content.ts`-ში `portfolio` სიაში შეცვალე `img`, `title`, `meta`, `alt`.
- **ტიპები:** ჩადე ფოტო `public/images/types/`-ში — `ID-480.jpg` (480×360) და `ID-960.jpg` (960×720), 4:3 პროპორციით; `ID` უნდა ემთხვეოდეს `src/data/content.ts`-ის `ceilingTypes` სიის `id`-ს.
- **განათება:** შეცვალე `public/images/lighting/lighting-800.jpg` (800×500) და `lighting-1600.jpg` (1600×1000), 16:10 პროპორციით.
