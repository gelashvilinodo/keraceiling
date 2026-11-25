# დროებითი ფოტოები (placeholder)

ყველა ფოტო Unsplash-იდანაა, **Unsplash License** — უფასოა კომერციული გამოყენებისთვის, ავტორის მითითება სავალდებულო არ არის.
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

„ადრე“ ფოტო (before-after/before-*.jpg) — მომხმარებლის მიერ მოწოდებული ფაილი.

## როგორ ჩავანაცვლო რეალური ფოტოთი

- **ნამუშევრები:** ჩადე ახალი ფოტო `public/images/portfolio/`-ში ორ ზომაში — `NAME-480.jpg` (480×600) და `NAME-960.jpg` (960×1200), 4:5 პროპორციით; შემდეგ `src/data/content.ts`-ში `portfolio` სიაში შეცვალე `img`, `title`, `meta`, `alt`.
- **განათება:** შეცვალე `public/images/lighting/lighting-800.jpg` (800×500) და `lighting-1600.jpg` (1600×1000), 16:10 პროპორციით.
