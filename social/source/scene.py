import bpy, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0]
W, H = int(argv[1]), int(argv[2])
SAMPLES = int(argv[3])
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------- reset ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

# ---------- import logo ----------
bpy.ops.import_curve.svg(filepath=os.path.join(HERE, "shapes.svg"))
objs = {o.name: o for o in bpy.data.objects if o.type == 'CURVE'}
S = 10.0
for o in objs.values():
    o.scale = (S, S, S)
bpy.context.view_layer.update()

# px -> local mapping from ceiling bbox (svg x 114..416, y 11.2086..170.709)
def bbox(o):
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (min(c.x for c in cs), max(c.x for c in cs), min(c.y for c in cs), max(c.y for c in cs))
cx0, cx1, cy0, cy1 = bbox(objs['ceiling'])
sx = (cx1 - cx0) / (416 - 114)
def px(x, y):
    X = cx0 + (x - 114) * sx
    Y = cy1 - (y - 11.2086) * sx
    return X, Y
# logo centre
lx0, ly1 = px(0, 0); lx1, ly0 = px(416, 246)
ccx, ccy = (lx0 + lx1) / 2, (ly0 + ly1) / 2

GAP = 0.03  # standoff from wall
spec = {  # name: (depth, front z)
    'k-stem-bottom': (0.028, GAP + 0.028),
    'ceiling':       (0.018, GAP + 0.020),
    'ribbon':        (0.030, GAP + 0.036),
    'k-stem-top':    (0.036, GAP + 0.044),
    'k-leg':         (0.036, GAP + 0.044),
}
for n, (d, front) in spec.items():
    o = objs[n]
    c = o.data
    c.dimensions = '2D'
    c.fill_mode = 'BOTH'
    c.extrude = d / 2 / S
    c.bevel_depth = 0.0028 / S
    c.bevel_resolution = 3
    c.resolution_u = 24
    o.location.z = front - d / 2

# ---------- materials ----------
def principled(name, base, metal, rough, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m, b

def add_noise_bump(m, scale, strength, stretch=(1, 1, 1), rough_mod=None, bsdf=None):
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = stretch
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 12
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength
    bp.inputs["Distance"].default_value = 0.002
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    b = bsdf or nt.nodes["Principled BSDF"]
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    if rough_mod:
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = rough_mod
        nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])

m_black, _ = principled("BlackSatin", (0.006, 0.006, 0.006), 0.3, 0.3,
                        **{"Coat Weight": 0.35, "Coat Roughness": 0.12})
add_noise_bump(m_black, 900, 0.04, rough_mod=(0.28, 0.4))

m_gold, _ = principled("BrushedGold", (0.86, 0.68, 0.40), 1.0, 0.24,
                       **{"Anisotropic": 0.6})
add_noise_bump(m_gold, 400, 0.08, stretch=(0.02, 1, 1), rough_mod=(0.18, 0.32))

m_ceil, _ = principled("ChampagnePanel", (0.62, 0.50, 0.34), 0.55, 0.38)
add_noise_bump(m_ceil, 1200, 0.03)

m_wall, b_wall = principled("Microcement", (0.40, 0.365, 0.325), 0.0, 0.85)
# plaster: two noise scales mixed into colour + bump
nt = m_wall.node_tree
tc = nt.nodes.new("ShaderNodeTexCoord")
n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 3; n1.inputs["Detail"].default_value = 8
n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 60; n2.inputs["Detail"].default_value = 15
nt.links.new(tc.outputs["Object"], n1.inputs["Vector"]); nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.33, 0.30, 0.265, 1)
ramp.color_ramp.elements[1].color = (0.45, 0.41, 0.365, 1)
nt.links.new(n1.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], b_wall.inputs["Base Color"])
bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.25; bp.inputs["Distance"].default_value = 0.003
nt.links.new(n2.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b_wall.inputs["Normal"])

m_trim, _ = principled("LampTrim", (0.85, 0.70, 0.46), 1.0, 0.3)
m_emit = bpy.data.materials.new("LampEmit"); m_emit.use_nodes = True
eb = m_emit.node_tree.nodes["Principled BSDF"]
eb.inputs["Base Color"].default_value = (1, 0.95, 0.85, 1)
eb.inputs["Emission Color"].default_value = (1.0, 0.80, 0.55, 1)
eb.inputs["Emission Strength"].default_value = 22

for n, m in [('k-stem-bottom', m_black), ('k-stem-top', m_black), ('k-leg', m_black),
             ('ribbon', m_gold), ('ceiling', m_ceil)]:
    objs[n].data.materials.clear(); objs[n].data.materials.append(m)

# ---------- downlights on the ceiling panel ----------
lamp_px = [(201.5, 120.7), (263.5, 98.2), (327.5, 120.7)]
ceil_front = spec['ceiling'][1]
lamp_local = []
for (x, y) in lamp_px:
    X, Y = px(x, y)
    lamp_local.append(Vector((X, Y, ceil_front)))
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1, depth=1, location=(X, Y, ceil_front + 0.002))
    t = bpy.context.object; t.scale = (17.5 * sx, 7.5 * sx, 0.004); t.data.materials.append(m_trim)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1, depth=1, location=(X, Y, ceil_front + 0.0045))
    e = bpy.context.object; e.scale = (14.5 * sx, 5.9 * sx, 0.002); e.data.materials.append(m_emit)
    bpy.ops.object.shade_smooth()

# ---------- group & stand up on wall ----------
root = bpy.data.objects.new("LogoRoot", None); scn.collection.objects.link(root)
for o in list(scn.objects):
    if o is not root and o.parent is None:
        o.parent = root
        o.location.x -= ccx; o.location.y -= ccy
root.rotation_euler = (math.radians(90), 0, 0)   # local +Z -> world -Y (towards camera)
root.location = (0, 0, 1.6)
logo_coll = bpy.data.collections.new("LogoOnly")
for o in root.children: logo_coll.objects.link(o)
bpy.context.view_layer.update()
M = root.matrix_world
lamp_world = [M @ (v - Vector((ccx, ccy, 0))) for v in lamp_local]

# wall at y=0, facing -Y
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 1.6), rotation=(math.radians(90), 0, 0))
wall = bpy.context.object; wall.data.materials.append(m_wall)
wall_coll = bpy.data.collections.new("WallOnly"); wall_coll.objects.link(wall)
# floor (out of frame, for bounce)
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, -6, -0.1))
fl = bpy.context.object
m_floor, _ = principled("Floor", (0.25, 0.18, 0.12), 0.0, 0.6); fl.data.materials.append(m_floor)

# ---------- lights ----------
def kelvin(k):
    n = bpy.data.node_groups  # unused; simple presets
    return {2700: (1.0, 0.72, 0.42), 3000: (1.0, 0.77, 0.52), 4000: (1.0, 0.86, 0.72), 5000: (1.0, 0.93, 0.86)}[k]

# wall-wash spots from each downlight: sit just in front of the lamp, aim down the wall
for p in lamp_world:
    ld = bpy.data.lights.new("Wash", 'SPOT'); ld.energy = 28; ld.color = kelvin(2700)
    ld.spot_size = math.radians(58); ld.spot_blend = 0.55; ld.shadow_soft_size = 0.01
    lo = bpy.data.objects.new("Wash", ld); scn.collection.objects.link(lo)
    lo.location = (p.x, -0.075, p.z - 0.02)
    # point mostly down (-Z), slightly into the wall (+Y)
    d = Vector((0, 0.22, -1)).normalized()
    lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    lo.light_linking.receiver_collection = wall_coll
    lo.light_linking.blocker_collection = wall_coll

# soft key, top-left, grazing to reveal plaster
kd = bpy.data.lights.new("Key", 'AREA'); kd.energy = 95; kd.size = 1.2; kd.color = kelvin(4000)
ko = bpy.data.objects.new("Key", kd); scn.collection.objects.link(ko)
ko.location = (-2.2, -1.1, 3.4)
ko.rotation_euler = (Vector((0.3, 0, 1.6)) - ko.location).to_track_quat('-Z', 'Y').to_euler()

# cool-neutral fill from right, very low
fd = bpy.data.lights.new("Fill", 'AREA'); fd.energy = 8; fd.size = 2.5; fd.color = kelvin(5000)
fo = bpy.data.objects.new("Fill", fd); scn.collection.objects.link(fo)
fo.location = (2.5, -2.5, 1.8)
fo.rotation_euler = (Vector((0, 0, 1.6)) - fo.location).to_track_quat('-Z', 'Y').to_euler()

# warm halo behind the sign (wall glow from hidden LED strip)
hd = bpy.data.lights.new("Halo", 'AREA'); hd.energy = 6; hd.size = 0.9; hd.size_y = 0.4
hd.shape = 'RECTANGLE'; hd.color = kelvin(2700)
ho = bpy.data.objects.new("Halo", hd); scn.collection.objects.link(ho)
ho.location = (0.1, -0.012, 1.68); ho.rotation_euler = (math.radians(-90), 0, 0)  # faces +Y (wall)
ho.visible_camera = False

# reflector softbox: above/in front, seen only in reflections
rd = bpy.data.lights.new("Reflector", 'AREA'); rd.energy = 60; rd.shape = 'RECTANGLE'
rd.size = 3.0; rd.size_y = 0.8; rd.color = kelvin(3000)
ro = bpy.data.objects.new("Reflector", rd); scn.collection.objects.link(ro)
ro.location = (-0.3, -1.6, 2.9)
ro.rotation_euler = (Vector((0, 0, 1.6)) - ro.location).to_track_quat('-Z', 'Y').to_euler()
ro.light_linking.receiver_collection = logo_coll
# lower warm bounce card so gold edges pick up a second highlight
bd = bpy.data.lights.new("Bounce", 'AREA'); bd.energy = 25; bd.shape = 'RECTANGLE'
bd.size = 2.0; bd.size_y = 0.5; bd.color = kelvin(2700)
bo = bpy.data.objects.new("Bounce", bd); scn.collection.objects.link(bo)
bo.location = (0.8, -1.8, 0.6)
bo.rotation_euler = (Vector((0, 0, 1.6)) - bo.location).to_track_quat('-Z', 'Y').to_euler()
bo.light_linking.receiver_collection = logo_coll

world = bpy.data.worlds.new("W"); scn.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.011, 0.010, 1)

# ---------- camera ----------
cd = bpy.data.cameras.new("Cam"); cd.lens = 55 if W < H else (60 if W / H < 1.2 else 42)
cd.dof.use_dof = True; cd.dof.aperture_fstop = 4.0
co = bpy.data.objects.new("Cam", cd); scn.collection.objects.link(co); scn.camera = co
aspect = W / H
target = Vector((0.04, 0, 1.30 if aspect < 1 else (1.42 if aspect < 1.2 else 1.50)))
co.location = target + Vector((-0.45, -3.0, 0.15))
co.rotation_euler = (target - co.location).to_track_quat('-Z', 'Y').to_euler()
cd.dof.focus_distance = (Vector((0, -0.05, 1.6)) - co.location).length
cd.sensor_fit = 'HORIZONTAL'; cd.sensor_width = 36 if aspect >= 1 else 30

# ---------- render ----------
r = scn.render
r.engine = 'CYCLES'; r.resolution_x = W; r.resolution_y = H; r.resolution_percentage = 100
r.filepath = OUT; r.image_settings.file_format = 'PNG'
c = scn.cycles; c.samples = SAMPLES; c.use_denoising = True
c.max_bounces = 8
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for dev in prefs.devices: dev.use = True
    c.device = 'GPU'
except Exception as e:
    print("GPU fallback", e)
scn.view_settings.view_transform = 'AgX'
scn.view_settings.look = 'AgX - Medium High Contrast'
scn.view_settings.exposure = 0.0
bpy.ops.render.render(write_still=True)
xs=[(o.matrix_world @ Vector(c)).x for o in root.children for c in o.bound_box]
print("DONE", OUT, "logo x", round(min(xs),3), round(max(xs),3))
