# �u�{�u����v�h�D�G�������ծ֤�

�o�O**�|���W�u�禬�����ժ�**�A���O�i��J�����ϥΪ�����t�ΡC�w�ǳƨ�ӬJ���u��տ��ɮסB���A���ݵn�J���޲z�������ΡB�v�����v�h�D�θ�Ʈw migration�F�Ҧ��\�ऴ���b�u�ꨭ���BMFA�BCloudflare�BSupabase �s�u�P��˸m���Һݨ�����ҡA���i�@���������ҡC

�ت��G�T�O����h�D�b�������|�B���n�J�B�����v�B�]�w�ʥ��α��v�A�ȬG�ٮɡA���|Ū���u��귽�C��@�̿� `authorize` �Ѧ��A���i�a���Ҩ����Υثe���v�����v�A�B������ Cloudflare Worker ���B�z�Ҧ��귽���|�C������@�e�������թҦ�����BCookie�BRLS�B�귽¶�L�B�֨��B�u��ۨ��ɮ׻P����n�J�y�{�C

�����q�Y��ڵ� URL �s�X�r���Υ��M�g���|�A�o�i�ण�ۮe�{���u��겣�F�ݽL�I�γ]�p�w�����зǤƳB�z��~��E���C����̥����������իź٥������p�w���C

`worker-entry.mjs` �ϥ� Supabase �����A���� SDK �޲z Cookie�B���Ҩ����F`web-app.mjs` �b���Τu��귽�e�d�߸�Ʈw���v�C`supabase-authorizer.mjs` �O�t�@�ӿW�ߪ����դ����A�|�����J��� Worker�C��Ʈw���޲z�ާ@�n�D MFA �P�����Ī��u�@���q�F��l�֦��̩|���إߡC

## ���p�e�����n�ƶ�

- ���կ������]�w `SITE_ORIGIN`�B`SUPABASE_URL` �P `SUPABASE_PUBLISHABLE_KEY`�A�䤤 `SITE_ORIGIN` ���P���I HTTPS ���}�����ۦP�C���]�w�ɹh�D�|�^ 503�C���� secret��service role key �����o��J�x�s�w�C
- `wrangler.jsonc` �� `assets.run_worker_first` �����O�� `true`�C���ե�������B�������}�B�R�A�ɮ׻P�� GitHub ���}�O�_�i¶�L�A������ `no-store`�C
- ����֦��̥������b�����������u����U�P�q�l�l�����ҡA�g�T�{������~�ѥi�H�޲z�̪�l�ƨ���C�޲z�ާ@�������� MFA ���ҡC
- Google OAuth�B���U���ҫH�B�K�X���]�B�ϥβέp�B�B�~ 40 �Ӥu��P�¤��}���}�B�z�|�������ι���C��Ӹտ�u��i�ऴ�t�s���¤��}�������s���C
- �����ϥ� Node �������աA�L�k�N���u�� SDK�B�s�����ζ������Ҥw���ҡC���p�e�����滷�ݫظm�B�n�J�B���v�θ귽��¶�L���աA�ðO�����G�C

���楻�����աG`node --test *.test.mjs`

