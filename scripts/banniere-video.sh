#!/usr/bin/env bash
# Fabrique la vidéo de la bannière d'accueil à partir de trois photos (ffmpeg requis).
#
#   bash scripts/banniere-video.sh
#
# Photos utilisées (public/images/accueil/), dans l'ordre d'affichage :
#   banniere.jpg, banniere-pratique.jpg, banniere-cours.jpg
# Pour changer une photo : remplacez le fichier (même nom), relancez le script.
#
# Chaque photo reste 7 s avec un zoom lent, puis un fondu de 1,2 s vers la suivante.
# La vidéo dure 21 s et boucle sans coupure (elle commence et finit sur la même image).
# Si vous changez la durée par photo, modifiez aussi SEGMENT dans src/components/home-hero.tsx.
set -euo pipefail
cd "$(dirname "$0")/../public/images/accueil"

D=246   # 8,2 s à 30 images/s : 7 s affichée + 1,2 s de fondu
DB=36   # 1,2 s : retour sur la première photo, pour une boucle sans coupure
zp() { echo "scale=6400:-2,crop=6400:3600,zoompan=z='$1':x='$2':y='$3':d=$4:s=1600x900:fps=30,setsar=1,format=yuv420p"; }
CX="iw/2-(iw/zoom/2)"; CY="ih/2-(ih/zoom/2)"

ffmpeg -y -loglevel error \
  -i banniere.jpg -i banniere-pratique.jpg -i banniere-cours.jpg -i banniere.jpg \
  -filter_complex "\
[0:v]$(zp "1+0.0005*on" "$CX" "$CY" $D)[v0];\
[1:v]$(zp "1.13-0.0005*on" "$CX" "$CY" $D)[v1];\
[2:v]$(zp "1+0.0005*on" "(iw-iw/zoom)*0.35" "$CY" $D)[v2];\
[3:v]$(zp "1+0.0005*on" "$CX" "$CY" $DB)[v3];\
[v0][v1]xfade=transition=fade:duration=1.2:offset=7[x1];\
[x1][v2]xfade=transition=fade:duration=1.2:offset=14[x2];\
[x2][v3]xfade=transition=fade:duration=1.2:offset=21,trim=start=1.2,setpts=PTS-STARTPTS[out]" \
  -map "[out]" -c:v libx264 -preset slow -crf 26 -profile:v high -pix_fmt yuv420p -movflags +faststart -an \
  banniere-video.mp4

# Version légère pour les téléphones
ffmpeg -y -loglevel error -i banniere-video.mp4 -vf scale=960:540 \
  -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart -an banniere-video-mobile.mp4

ls -la banniere-video*.mp4
